// Play a local match in the terminal, without the browser: npm run debug [map]
// P1: WASD + R    P2: arrows + L    Q or Ctrl+C: quit
import { emitKeypressEvents } from "node:readline";
import { MONSTER_INTERVAL_MS } from "./config";
import { GameRoom, type PlayerInfo } from "./GameRoom";
import { loadMap, mapSize } from "./mapLoader";
import type { Direction, GameEvent, PlayerView, PowerUpType } from "./types";

const COUNTDOWN_MS = 3000;
const DRAW_INTERVAL_MS = 100;

const PLAYERS: PlayerInfo[] = [
	{ userId: null, username: "P1", character: "goldfish" },
	{ userId: null, username: "P2", character: "betta" },
];

// key name -> [slot, what to do]
const KEYS: Record<string, [number, Direction | "power"]> = {
	w: [0, "up"],
	a: [0, "left"],
	s: [0, "down"],
	d: [0, "right"],
	r: [0, "power"],
	up: [1, "up"],
	left: [1, "left"],
	down: [1, "down"],
	right: [1, "right"],
	l: [1, "power"],
};

const POWERUP_CHARS: Record<PowerUpType, string> = { speed: "s", freeze: "f", enchant: "e" };

if (!process.stdin.isTTY) {
	console.error("debug.ts needs a terminal (it reads the keys one by one)");
	process.exit(1);
}

const mapName = process.argv[2] ?? "small-1";
const map = loadMap(mapName);
const room = new GameRoom("debug", mapName, map, mapSize(mapName), PLAYERS, { local: true });
const startAt = Date.now() + COUNTDOWN_MS;
const log: string[] = [];

function seconds(ms: number): string {
	return (ms / 1000).toFixed(1) + "s";
}

function clock(ms: number): string {
	const total = Math.ceil(ms / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function eventText(e: GameEvent): string {
	const who = PLAYERS[e.slot].username;
	switch (e.type) {
		case "diamond":
			return `${who} picked a diamond`;
		case "powerUpPickup":
			return `${who} picked ${e.powerUp}`;
		case "powerUpUsed":
			return `${who} used ${e.powerUp}`;
		case "death":
			return `${who} was eaten by a shark`;
	}
}

function playerLine(p: PlayerView, goal: number): string {
	const tags: string[] = [];
	if (p.status !== "playing")
		tags.push(p.status === "dead" ? `dead ${seconds(p.respawnMs)}` : p.status);
	if (p.frozenMs > 0)
		tags.push(`frozen ${seconds(p.frozenMs)}`);
	if (p.speedMs > 0)
		tags.push(`speed ${seconds(p.speedMs)}`);
	if (p.enchantedMs > 0)
		tags.push(`enchanted ${seconds(p.enchantedMs)}`);
	if (p.invulnerableMs > 0)
		tags.push("invulnerable");
	return `${"ABCD"[p.slot]} ${p.username}  diamonds ${p.diamonds}/${goal}  deaths ${p.deaths}`
		+ `  power-up ${p.powerUp ?? "-"}  ${tags.join(", ")}`;
}

function draw(now: number): void {
	const snap = room.snapshot(now);
	const grid: string[][] = map.walls.map((row) => row.map((wall) => (wall ? "#" : " ")));
	grid[map.exit.y][map.exit.x] = "E";
	for (const d of snap.diamonds)
		grid[d.y][d.x] = "$";
	for (const p of snap.powerUps)
		grid[p.pos.y][p.pos.x] = POWERUP_CHARS[p.type];
	for (const m of snap.monsters)
		grid[m.y][m.x] = "M";
	for (const p of snap.players)
		if (p.status !== "dead" && p.status !== "left")
			grid[p.pos.y][p.pos.x] = "ABCD"[p.slot];

	const lines = [`Open Sea - ${mapName}`, ""];
	if (snap.status === "countdown")
		lines.push(`starts in ${seconds(startAt - now)}`);
	else
		lines.push(`time ${clock(snap.timeLeftMs)}` + (snap.monstersFrozenMs > 0 ? `  sharks frozen ${seconds(snap.monstersFrozenMs)}` : ""));
	lines.push("", ...grid.map((row) => row.join("")), "");
	for (const p of snap.players)
		lines.push(playerLine(p, snap.goal));
	lines.push("");
	if (snap.status === "finished") {
		const winner = snap.winnerSlot === null ? "nobody" : PLAYERS[snap.winnerSlot].username;
		lines.push(`GAME OVER: ${winner} wins (${snap.endReason})   Q to quit`);
	}
	else
		lines.push("P1: WASD + R   P2: arrows + L   Q: quit");
	lines.push("", ...log.slice(-5));
	// \x1b[H = cursor to the top, \x1b[K = clear the rest of the line, \x1b[J = clear below
	process.stdout.write("\x1b[H" + lines.map((line) => line + "\x1b[K").join("\n") + "\x1b[J");
}

function quit(): void {
	process.stdin.setRawMode(false);
	process.stdout.write("\x1b[?25h\n"); // show the cursor again
	process.exit(0);
}

emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdout.write("\x1b[?25l\x1b[2J"); // hide the cursor, clear the screen

process.stdin.on("keypress", (_text: string, key: { name?: string; ctrl?: boolean }) => {
	if (!key?.name)
		return;
	if (key.name === "q" || (key.ctrl && key.name === "c"))
		quit();
	const action = KEYS[key.name];
	if (!action)
		return;
	const [slot, what] = action;
	if (what === "power")
		room.usePowerUp(slot, Date.now());
	else
		room.move(slot, what, Date.now());
});

setInterval(() => room.tickMonsters(Date.now()), MONSTER_INTERVAL_MS);
setInterval(() => room.tickSecond(Date.now()), 1000);
setInterval(() => {
	const now = Date.now();
	if (room.state.status === "countdown" && now >= startAt)
		room.start(now);
	for (const e of room.takeEvents())
		log.push(eventText(e));
	draw(now);
}, DRAW_INTERVAL_MS);
