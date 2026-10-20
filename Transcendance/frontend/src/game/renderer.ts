// Draws one frame of the match on the canvas (no React here, only the canvas API)
import type { DynamicState, MapInfo, PlayerView, Position } from "./protocol";
import type { Sprites } from "./sprites";

type Facing = "left" | "right";

// The server only sends where each shark is: the side it faces comes from how it moved
export type SharkMemory = {
	last: Position[];
	facing: Facing[];
};

// Everything needed to draw one frame
export type Frame = {
	ctx: CanvasRenderingContext2D;
	sprites: Sprites;
	mapImage: HTMLImageElement | null; // null = no image yet, draw the map in blocks
	map: MapInfo;
	state: DynamicState;
	tile: number; // size of one cell on the screen, in px
	now: number; // ms, for the animations (blinking, hearts)
	mySlot: number | null; // whose screen this is (null = local match, both players)
	showWalls: boolean; // F2
	sharks: SharkMemory;
};

const WALL = "#1b2b36";
const FLOOR = "#0f4c6e";
const FLOOR_ALT = "#0d4563"; // every other cell, so the grid can be seen

// Compares with the last positions to know the side each shark faces
export function trackSharks(memory: SharkMemory, monsters: Position[]): void {
	for (let i = 0; i < monsters.length; i++) {
		const before = memory.last[i];
		if (before && monsters[i].x > before.x)
			memory.facing[i] = "right";
		else if (before && monsters[i].x < before.x)
			memory.facing[i] = "left";
		else if (!memory.facing[i])
			memory.facing[i] = "left";
	}
	memory.last = monsters.map((m) => ({ ...m }));
}

// One sprite on one cell of the map
function drawSprite(f: Frame, image: HTMLImageElement, pos: Position): void {
	f.ctx.drawImage(image, pos.x * f.tile, pos.y * f.tile, f.tile, f.tile);
}

// The map in coloured blocks (for the maps that have no image yet)
function drawBoard(f: Frame): void {
	const { ctx, map, tile } = f;
	for (let y = 0; y < map.height; y++) {
		for (let x = 0; x < map.width; x++) {
			if (map.walls[y][x])
				ctx.fillStyle = WALL;
			else
				ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR : FLOOR_ALT;
			ctx.fillRect(x * tile, y * tile, tile, tile);
		}
	}
	drawSprite(f, f.sprites["exit-turtle"], map.exit);
}

// F2: the walls of the .ber in red and the grid, to check that the art matches
function drawWalls(f: Frame): void {
	const { ctx, map, tile } = f;
	ctx.fillStyle = "rgba(255, 0, 0, 0.35)";
	ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
	ctx.lineWidth = 1;
	for (let y = 0; y < map.height; y++) {
		for (let x = 0; x < map.width; x++) {
			if (map.walls[y][x])
				ctx.fillRect(x * tile, y * tile, tile, tile);
			ctx.strokeRect(x * tile, y * tile, tile, tile);
		}
	}
}

function drawDiamonds(f: Frame): void {
	for (const diamond of f.state.diamonds)
		drawSprite(f, f.sprites["item-diamond"], diamond);
}

function drawPowerUps(f: Frame): void {
	for (const powerUp of f.state.powerUps)
		drawSprite(f, f.sprites[`item-${powerUp.type}`], powerUp.pos);
}

// Frozen sharks are blue; on the screen of an enchanted player they look harmless
function drawMonsters(f: Frame): void {
	const me = f.state.players.find((p) => p.slot === f.mySlot);
	let look = "shark";
	if (f.state.monstersFrozenMs > 0)
		look = "shark-frozen";
	else if (me && me.enchantedMs > 0)
		look = "shark-enchanted";
	for (let i = 0; i < f.state.monsters.length; i++)
		drawSprite(f, f.sprites[`${look}-${f.sharks.facing[i] ?? "left"}`], f.state.monsters[i]);
}

function drawPlayer(f: Frame, p: PlayerView): void {
	const { ctx, tile, now } = f;
	const x = p.pos.x * tile;
	const y = p.pos.y * tile;
	const fish = f.sprites[`${p.character}-${p.facing}`];

	ctx.save(); // everything changed until restore() (transparency, colours) is undone there
	if (p.status === "disconnected")
		ctx.globalAlpha = 0.4;
	else if (p.invulnerableMs > 0 && Math.floor(now / 120) % 2 === 0)
		ctx.globalAlpha = 0.3; // blinks: half of the time almost invisible
	const alpha = ctx.globalAlpha;

	// speed: two faded copies behind the fish
	if (p.speedMs > 0) {
		const back = p.facing === "right" ? -tile : tile;
		ctx.globalAlpha = alpha * 0.35;
		ctx.drawImage(fish, x + back * 0.3, y, tile, tile);
		ctx.globalAlpha = alpha * 0.15;
		ctx.drawImage(fish, x + back * 0.6, y, tile, tile);
		ctx.globalAlpha = alpha;
	}
	ctx.drawImage(fish, x, y, tile, tile);

	// frozen: a block of ice over the fish
	if (p.frozenMs > 0) {
		ctx.fillStyle = "rgba(170, 225, 255, 0.45)";
		ctx.strokeStyle = "rgba(230, 250, 255, 0.9)";
		ctx.lineWidth = Math.max(1, tile / 24);
		ctx.fillRect(x + tile * 0.08, y + tile * 0.08, tile * 0.84, tile * 0.84);
		ctx.strokeRect(x + tile * 0.08, y + tile * 0.08, tile * 0.84, tile * 0.84);
	}

	// enchanted: three hearts going around the fish
	if (p.enchantedMs > 0) {
		ctx.fillStyle = "#ff6fb5";
		ctx.font = `${Math.round(tile * 0.3)}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		for (let i = 0; i < 3; i++) {
			const angle = now / 500 + (i * 2 * Math.PI) / 3;
			ctx.fillText("♥", x + tile / 2 + Math.cos(angle) * tile * 0.42, y + tile / 2 + Math.sin(angle) * tile * 0.42);
		}
	}
	ctx.restore();

	// the power-up being held, small, in the bottom-right corner
	if (p.powerUp)
		ctx.drawImage(f.sprites[`icon-${p.powerUp}`], x + tile * 0.6, y + tile * 0.6, tile * 0.4, tile * 0.4);

	// the name above (white with a dark outline, readable on any background)
	ctx.font = `bold ${Math.max(10, Math.round(tile * 0.24))}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "bottom";
	ctx.lineWidth = 3;
	ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
	ctx.strokeText(p.username, x + tile / 2, y + 2);
	ctx.fillStyle = "#fff";
	ctx.fillText(p.username, x + tile / 2, y + 2);
}

function drawPlayers(f: Frame): void {
	for (const p of f.state.players)
		if (p.status !== "dead" && p.status !== "left")
			drawPlayer(f, p);
}

// Text with a dark outline, readable on any background
function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
	ctx.font = `bold ${size}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineWidth = Math.max(2, size / 6);
	ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
	ctx.strokeText(text, x, y);
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

// 154000 ms -> "2:34" (rounded up: shows "0:01" until the very end)
function formatTime(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// The clock, in the middle of the top border (red in the last 10 s)
function drawClock(f: Frame): void {
	const { ctx, map, tile } = f;
	const width = tile;
	const height = tile * 0.7;
	const x = (map.width * tile - width) / 2;
	const y = (tile - height) / 2;
	ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, tile * 0.12);
	ctx.fill();
	const color = f.state.timeLeftMs <= 10_000 ? "#ff5a5a" : "#fff";
	drawLabel(ctx, formatTime(f.state.timeLeftMs), x + width / 2, y + height / 2, Math.round(tile * 0.35), color);
}

// One player on the border of the map: players 0 and 1 at the top, 2 and 3 at the bottom;
// the even ones from the left corner to the right, the odd ones from the right corner to the left.
// Order from the corner: portrait, diamond bar, power-up bubble, deaths
function drawPlayerHud(f: Frame, p: PlayerView): void {
	const { ctx, map, tile } = f;
	const fromRight = p.slot % 2 === 1;
	const y = p.slot < 2 ? 0 : (map.height - 1) * tile;
	// x of something that starts "offset" px away from its corner and has "width" px
	const place = (offset: number, width: number) => (fromRight ? map.width * tile - offset - width : offset);

	const bar = f.sprites[`diamonds-${f.state.goal}/${Math.min(p.diamonds, f.state.goal)}`];
	const barWidth = (bar.width / bar.height) * tile; // keeps the proportion of the image: 3 cells (goal 5) or 6 (goal 10)
	const portraitX = place(0, tile);
	const barX = place(tile, barWidth);
	const bubbleX = place(tile + barWidth, tile);
	const deathsX = place(tile * 2 + barWidth, tile);

	// portrait: faded while dead, disconnected or gone; while dead, the seconds left to come back
	ctx.save();
	if (p.status === "dead" || p.status === "disconnected" || p.status === "left")
		ctx.globalAlpha = 0.4;
	ctx.drawImage(f.sprites[`portrait-${p.character}`], portraitX, y, tile, tile);
	ctx.restore();
	if (p.status === "dead")
		drawLabel(ctx, String(Math.ceil(p.respawnMs / 1000)), portraitX + tile / 2, y + tile / 2, Math.round(tile * 0.5), "#fff");

	ctx.drawImage(bar, barX, y, barWidth, tile);

	// empty bubble, or the bubble with the power-up being held inside
	ctx.drawImage(f.sprites["bubble"], bubbleX, y, tile, tile);
	if (p.powerUp)
		ctx.drawImage(f.sprites[`icon-${p.powerUp}`], bubbleX + tile * 0.2, y + tile * 0.2, tile * 0.6, tile * 0.6);

	drawLabel(ctx, `☠ ${p.deaths}`, deathsX + tile / 2, y + tile / 2, Math.round(tile * 0.3), "#fff");
}

function drawHud(f: Frame): void {
	drawClock(f);
	for (const p of f.state.players)
		drawPlayerHud(f, p);
}

// Everything, from the back to the front (what is drawn later covers what was drawn before)
export function drawFrame(f: Frame): void {
	if (f.mapImage)
		f.ctx.drawImage(f.mapImage, 0, 0, f.map.width * f.tile, f.map.height * f.tile);
	else
		drawBoard(f);
	drawDiamonds(f);
	drawPowerUps(f);
	drawMonsters(f);
	drawPlayers(f);
	drawHud(f);
	if (f.showWalls)
		drawWalls(f);
}
