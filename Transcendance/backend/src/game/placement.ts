import { MONSTER_MIN_SPAWN_DISTANCE } from "./config";
import type { GameState, MapData, Position, PowerUp, PowerUpType } from "./types";

export const POWERUP_TYPES: PowerUpType[] = ["speed", "freeze", "enchant"];

// To use a position as a key of Set/Map | "3,5" 
export function posKey(pos: Position): string {
	return `${pos.x},${pos.y}`;
}

// Steps from start to every reachable floor cell
export function distancesFrom(map: MapData, start: Position): Map<string, number> {
	const dist = new Map([[posKey(start), 0]]);
	const queue = [start];
	for (let i = 0; i < queue.length; i++) {
		const { x, y } = queue[i];
		for (const next of [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]) {
			if (map.walls[next.y][next.x] || dist.has(posKey(next)))
				continue;
			dist.set(posKey(next), dist.get(posKey({ x, y }))! + 1);
			queue.push(next);
		}
	}
	return dist;
}

// Floor cells that are not the exit, a spawn or in occupied
export function freeCells(map: MapData, occupied: Position[] = []): Position[] {
	const taken = new Set([map.exit, ...map.spawns, ...occupied].map(posKey));
	const cells: Position[] = [];
	for (let y = 0; y < map.height; y++)
		for (let x = 0; x < map.width; x++)
			if (!map.walls[y][x] && !taken.has(posKey({ x, y })))
				cells.push({ x, y });
	return cells;
}

// Randomly select “count” different cells from the list of cells
function pickRandom(cells: Position[], count: number, random: () => number): Position[] {
	if (count > cells.length)
		throw new Error(`not enough free cells: need ${count}, have ${cells.length}`);
	const pool = [...cells];
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(random() * (pool.length - i));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, count);
}

// Sharks start at least MONSTER_MIN_SPAWN_DISTANCE steps away from every spawn
export function placeMonsters(map: MapData, count: number, random: () => number): Position[] {
	const fromSpawns = map.spawns.map((spawn) => distancesFrom(map, spawn));
	const far: Position[] = [];
	for (const cell of freeCells(map))
		if (isFarFromSpawns(cell, fromSpawns))
			far.push(cell);
	return pickRandom(far, count, random);
}

// true if cell is at least MONSTER_MIN_SPAWN_DISTANCE steps from every spawn
function isFarFromSpawns(cell: Position, fromSpawns: Map<string, number>[]): boolean {
	for (const dist of fromSpawns) {
		const steps = dist.get(posKey(cell)) ?? Infinity;
		if (steps < MONSTER_MIN_SPAWN_DISTANCE)
			return false;
	}
	return true;
}

// Diamonds anywhere free (occupied = exit, spawn, sharks...)
export function placeDiamonds(map: MapData, count: number, occupied: Position[], random: () => number): Position[] {
	return pickRandom(freeCells(map, occupied), count, random);
}

// One new power-up during the match, or null if there is no free cell
export function placePowerUp(map: MapData, state: GameState, random: () => number): PowerUp | null {
	const players = state.players.filter((p) => p.status !== "dead" && p.status !== "left").map((p) => p.pos);
	const powerUps = state.powerUps.map((p) => p.pos);
	const cells = freeCells(map, [...state.diamonds, ...state.monsters, ...powerUps, ...players]);
	if (cells.length === 0)
		return null;
	const [pos] = pickRandom(cells, 1, random);
	const type = POWERUP_TYPES[Math.floor(random() * POWERUP_TYPES.length)];
	return { type, pos };
}
