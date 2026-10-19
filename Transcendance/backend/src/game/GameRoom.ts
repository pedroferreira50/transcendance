import {
	ENCHANT_DURATION_MS, FREEZE_DURATION_MS, INVULNERABLE_MS, MAX_POWERUPS_ON_MAP, MOVE_COOLDOWN_MS, POWERUP_INTERVAL_MS,
	RECONNECT_TIMEOUT_MS, RESPAWN_DELAY_MS, SPEED_DURATION_MS, SIZE_RULES, diamondCount
} from "./config";
import { placeDiamonds, placeMonsters, placePowerUp } from "./placement";
import type {
	Character, Direction, DynamicState, EndReason, GameEvent, GameState, MapData, MapSize, Player, PlayerView, Position
} from "./types";

// Who joins the match (comes from the lobby)
export type PlayerInfo = {
	userId: number | null; // null = guest (local mode)
	username: string;
	character: Character;
};

export type RoomOptions = {
	local: boolean;
	random?: () => number; // default Math.random, tests pass a fixed one
};

// One match: all the rules of the game, without sockets or timers
export class GameRoom {
	state: GameState;
	dirty = false; // true = something changed and must be sent to the clients
	events: GameEvent[] = []; // what happened since the last takeEvents()
	private map: MapData;
	private size: MapSize;
	private random: () => number;

	constructor(id: string, mapName: string, map: MapData, size: MapSize, players: PlayerInfo[], options: RoomOptions) {
		const rules = SIZE_RULES[size];
		if (!rules.players.includes(players.length))
			throw new Error(`a ${size} map does not accept ${players.length} players`);
		this.map = map;
		this.size = size;
		this.random = options.random ?? Math.random;
		const monsters = placeMonsters(map, rules.monsters, this.random);
		this.state = {
			id,
			mapName,
			width: map.width,
			height: map.height,
			walls: map.walls,
			exit: map.exit,
			goal: rules.goal,
			players: players.map((info, slot) => newPlayer(info, slot, map.spawns[slot])),
			monsters,
			monstersFrozenUntil: 0,
			diamonds: placeDiamonds(map, diamondCount(size, players.length), monsters, this.random),
			powerUps: [],
			nextPowerUpAt: 0,
			endsAt: 0,
			status: "countdown",
			winnerSlot: null,
			endReason: null,
			local: options.local,
		};
	}

	// End of the countdown: the clock starts now
	start(now: number): void {
		if (this.state.status !== "countdown")
			return;
		this.state.status = "running";
		this.state.endsAt = now + SIZE_RULES[this.size].timeLimitMs;
		this.state.nextPowerUpAt = now + POWERUP_INTERVAL_MS;
		this.dirty = true;
	}

	// A player asks to move one cell (key pressed)
	move(slot: number, dir: Direction, now: number): void {
		const player = this.state.players[slot];
		if (this.state.status !== "running" || !player || player.status !== "playing")
			return;
		if (now < player.frozenUntil)
			return;
		const cooldown = now < player.speedUntil ? MOVE_COOLDOWN_MS / 2 : MOVE_COOLDOWN_MS;
		if (now - player.lastMoveAt < cooldown)
			return;
		if ((dir === "left" || dir === "right") && player.facing !== dir) {
			player.facing = dir;
			this.dirty = true;
		}
		const to = step(player.pos, dir);
		if (this.state.walls[to.y][to.x] || this.state.players.some((p) => isOnMap(p) && samePos(p.pos, to)))
			return;

		player.pos = to;
		player.lastMoveAt = now;
		player.moves++;
		this.dirty = true;

		// Is there a diamond in that position?
		const diamond = this.state.diamonds.findIndex((d) => samePos(d, to));
		if (diamond !== -1 && player.diamonds < this.state.goal) {
			this.state.diamonds.splice(diamond, 1);
			player.diamonds++;
			this.events.push({ type: "diamond", slot, pos: to });
		}
		const powerUp = this.state.powerUps.findIndex((p) => samePos(p.pos, to));
		if (powerUp !== -1 && player.powerUp === null) {
			player.powerUp = this.state.powerUps[powerUp].type;
			this.state.powerUps.splice(powerUp, 1);
			this.events.push({ type: "powerUpPickup", slot, powerUp: player.powerUp });
		}
		if (this.state.monsters.some((m) => samePos(m, to)))
			this.kill(player, now);
		if (samePos(to, this.state.exit) && player.diamonds === this.state.goal)
			this.finish(slot, "exit");
	}

	// A player uses the power-up they hold (R or L key)
	usePowerUp(slot: number, now: number): void {
		const player = this.state.players[slot];
		if (this.state.status !== "running" || !player || player.status !== "playing")
			return;
		if (now < player.frozenUntil || player.powerUp === null)
			return;
		switch (player.powerUp) {
			case "speed":
				player.speedUntil = now + SPEED_DURATION_MS;
				break;
			case "freeze":
				for (const other of this.state.players)
					if (other !== player && isOnMap(other))
						other.frozenUntil = now + FREEZE_DURATION_MS;
				this.state.monstersFrozenUntil = now + FREEZE_DURATION_MS;
				break;
			case "enchant":
				player.enchantedUntil = now + ENCHANT_DURATION_MS;
				break;
		}
		this.events.push({ type: "powerUpUsed", slot, powerUp: player.powerUp });
		player.powerUp = null;
		this.dirty = true;
	}

	// Every MONSTER_INTERVAL_MS: each shark tries one step in a random direction
	tickMonsters(now: number): void {
		if (this.state.status !== "running")
			return;
		const monsters = this.state.monsters;
		if (now >= this.state.monstersFrozenUntil) {
			for (let i = 0; i < monsters.length; i++) {
				const dir = DIRECTIONS[Math.floor(this.random() * DIRECTIONS.length)];
				const to = step(monsters[i], dir);
				if (this.state.walls[to.y][to.x] || samePos(to, this.state.exit) || monsters.some((m) => samePos(m, to)))
					continue;
				monsters[i] = to;
				this.dirty = true;
			}
		}
		for (const player of this.state.players)
			if (player.status === "playing" && monsters.some((m) => samePos(m, player.pos)))
				this.kill(player, now);
	}

	// Every 1s: end of the time, disconnections, respawns and new power-ups
	tickSecond(now: number): void {
		if (this.state.status !== "running")
			return;
		if (now >= this.state.endsAt) {
			this.finish(this.leader(), "timeout");
			return;
		}
		for (const player of this.state.players)
			if (player.disconnectedAt !== null && now - player.disconnectedAt >= RECONNECT_TIMEOUT_MS)
				this.leave(player.slot);
		if (this.state.status !== "running")
			return;
		for (const player of this.state.players) {
			if (player.status !== "dead" || now < player.respawnAt || !this.isFree(player.spawn))
				continue;
			if (player.disconnectedAt !== null)
				continue;
			player.status = "playing";
			player.pos = { ...player.spawn };
			player.invulnerableUntil = now + INVULNERABLE_MS;
			this.dirty = true;
		}
		if (now >= this.state.nextPowerUpAt) {
			if (this.state.powerUps.length < MAX_POWERUPS_ON_MAP) {
				const powerUp = placePowerUp(this.map, this.state, this.random);
				if (powerUp) {
					this.state.powerUps.push(powerUp);
					this.dirty = true;
				}
			}
			this.state.nextPowerUpAt = now + POWERUP_INTERVAL_MS;
		}
	}

	// Player gave up (or was away for too long)
	leave(slot: number): void {
		const player = this.state.players[slot];
		if (this.state.status === "finished" || !player || player.status === "left")
			return;
		player.status = "left";
		player.disconnectedAt = null;
		this.dirty = true;
		const inGame = this.state.players.filter((p) => p.status !== "left");
		if (inGame.length === 1)
			this.finish(inGame[0].slot, "forfeit");
	}

	// The socket of a player dropped (false) or came back (true)
	setConnected(slot: number, connected: boolean, now: number): void {
		const player = this.state.players[slot];
		if (this.state.status === "finished" || !player || player.status === "left")
			return;
		if (connected) {
			player.disconnectedAt = null;
			if (player.status === "disconnected")
				player.status = "playing";
		} else if (player.disconnectedAt === null) {
			player.disconnectedAt = now;
			if (player.status === "playing")
				player.status = "disconnected";
		}
		this.dirty = true;
	}

	// The events since the last call (and empties the list)
	takeEvents(): GameEvent[] {
		const events = this.events;
		this.events = [];
		return events;
	}

	// What goes in game:state
	snapshot(now: number): DynamicState {
		return {
			status: this.state.status,
			timeLeftMs: this.state.status === "countdown" ? SIZE_RULES[this.size].timeLimitMs : msLeft(this.state.endsAt, now),
			goal: this.state.goal,
			players: this.state.players.map((p) => playerView(p, now)),
			monsters: [...this.state.monsters],
			monstersFrozenMs: msLeft(this.state.monstersFrozenUntil, now),
			diamonds: [...this.state.diamonds],
			powerUps: [...this.state.powerUps],
			winnerSlot: this.state.winnerSlot,
			endReason: this.state.endReason,
		};
	}

	// No player and no shark on this cell (to respawn there)
	private isFree(pos: Position): boolean {
		return !this.state.players.some((p) => isOnMap(p) && samePos(p.pos, pos))
			&& !this.state.monsters.some((m) => samePos(m, pos));
	}

	// Slot of the player with the most diamonds, or null if the top is a tie
	private leader(): number | null {
		const inGame = this.state.players.filter((p) => p.status !== "left");
		const best = Math.max(...inGame.map((p) => p.diamonds));
		const top = inGame.filter((p) => p.diamonds === best);
		return top.length === 1 ? top[0].slot : null;
	}

	// A shark got the player (unless still protected)
	private kill(player: Player, now: number): void {
		if (now < player.invulnerableUntil || now < player.enchantedUntil)
			return;
		player.status = "dead";
		player.deaths++;
		player.respawnAt = now + RESPAWN_DELAY_MS;
		player.powerUp = null;
		this.events.push({ type: "death", slot: player.slot, pos: player.pos });
		this.dirty = true;
	}

	// After this, every method ignores the calls (status is no longer "running")
	private finish(winnerSlot: number | null, reason: EndReason): void {
		this.state.status = "finished";
		this.state.winnerSlot = winnerSlot;
		this.state.endReason = reason;
		this.dirty = true;
	}
}

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

const STEPS: Record<Direction, Position> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

function step(pos: Position, dir: Direction): Position {
	return { x: pos.x + STEPS[dir].x, y: pos.y + STEPS[dir].y };
}

function samePos(a: Position, b: Position): boolean {
	return a.x === b.x && a.y === b.y;
}

// Dead players and the ones who left are not on the map (they block nothing)
function isOnMap(player: Player): boolean {
	return player.status !== "dead" && player.status !== "left";
}

function newPlayer(info: PlayerInfo, slot: number, spawn: Position): Player {
	return {
		userId: info.userId,
		username: info.username,
		slot,
		character: info.character,
		pos: { ...spawn },
		spawn,
		diamonds: 0,
		moves: 0,
		deaths: 0,
		facing: "right",
		status: "playing",
		lastMoveAt: 0,
		respawnAt: 0,
		invulnerableUntil: 0,
		frozenUntil: 0,
		speedUntil: 0,
		enchantedUntil: 0,
		powerUp: null,
		disconnectedAt: null,
	};
}

// How long until a "until" time, 0 if it has passed
function msLeft(until: number, now: number): number {
	return Math.max(0, until - now);
}

function playerView(p: Player, now: number): PlayerView {
	return {
		slot: p.slot,
		username: p.username,
		character: p.character,
		pos: p.pos,
		diamonds: p.diamonds,
		moves: p.moves,
		deaths: p.deaths,
		facing: p.facing,
		status: p.status,
		powerUp: p.powerUp,
		respawnMs: p.status === "dead" ? msLeft(p.respawnAt, now) : 0,
		invulnerableMs: msLeft(p.invulnerableUntil, now),
		frozenMs: msLeft(p.frozenUntil, now),
		speedMs: msLeft(p.speedUntil, now),
		enchantedMs: msLeft(p.enchantedUntil, now),
	};
}
