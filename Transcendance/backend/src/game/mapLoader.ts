import fs from "node:fs";
import path from "node:path";
import { SIZE_RULES } from "./config";
import type { MapData, MapSize, Position } from "./types";

const MAPS_DIR = path.join(__dirname, "..", "..", "maps");

export type PlayerCount = 2 | 3 | 4;

export const MAPS: { name: string; size: MapSize }[] = [
	{ name: "small-1", size: "small" },
	{ name: "small-2", size: "small" },
	{ name: "medium-1", size: "medium" },
	{ name: "medium-2", size: "medium" },
	{ name: "large-1", size: "large" },
	{ name: "large-2", size: "large" },
];

const SPAWN_CHARS = "ABCD";

// Turns the text of a .ber file into MapData.
// Only checks what is needed to build a consistent MapData; the checks of
// our own maps (reachability, balance, space) live in __tests__/maps.test.ts.
export function parseMap(text: string): MapData {
	const rows = text.split(/\r?\n/).filter((row) => row.length > 0);
	if (rows.length === 0)
		throw new Error("map is empty");
	const width = rows[0].length;
	const height = rows.length;

	const walls: boolean[][] = [];
	let exit: Position | null = null;
	const spawns: (Position | undefined)[] = [];

	for (let y = 0; y < height; y++) {
		if (rows[y].length !== width)
			throw new Error(`row ${y} has ${rows[y].length} columns, expected ${width}`);
		walls.push([]);
		for (let x = 0; x < width; x++) {
			const ch = rows[y][x];
			walls[y].push(ch === "1");
			if (ch === "1" || ch === "0")
				continue;
			if (ch === "E") {
				if (exit)
					throw new Error("map has more than one exit");
				exit = { x, y };
			} else if (SPAWN_CHARS.includes(ch)) {
				const slot = SPAWN_CHARS.indexOf(ch);
				if (spawns[slot])
					throw new Error(`spawn ${ch} appears more than once`);
				spawns[slot] = { x, y };
			} else {
				throw new Error(`unknown character '${ch}' at (${x}, ${y})`);
			}
		}
	}

	if (!exit)
		throw new Error("map has no exit");
	// spawns must be A, A+B, A+B+C or A+B+C+D: no holes in the slots
	for (let slot = 0; slot < spawns.length; slot++)
		if (!spawns[slot])
			throw new Error(`spawn ${SPAWN_CHARS[slot]} is missing`);

	return { width, height, walls, exit, spawns: spawns as Position[] };
}

// Reads backend/maps/<name>.ber.
export function loadMap(name: string): MapData {
	if (!/^[a-z0-9-]+$/.test(name))
		throw new Error(`invalid map name '${name}'`);
	return parseMap(fs.readFileSync(path.join(MAPS_DIR, `${name}.ber`), "utf8"));
}

// The size of a map - "medium-1" -> "medium".
export function mapSize(name: string): MapSize {
	const map = MAPS.find((m) => m.name === name);
	if (!map)
		throw new Error(`unknown map '${name}'`);
	return map.size;
}

// The maps that accept this number of players.
export function mapsFor(playerCount: PlayerCount): string[] {
	return MAPS.filter((m) => SIZE_RULES[m.size].players.includes(playerCount)).map((m) => m.name);
}

// Chooses the map for a match or a random one of the right size
export function pickMap(playerCount: PlayerCount, choice: string, random: () => number): string {
	const options = mapsFor(playerCount);
	if (options.length === 0)
		throw new Error(`no maps for ${playerCount} players`);
	if (choice === "random")
		return options[Math.floor(random() * options.length)];
	if (!options.includes(choice))
		throw new Error(`map '${choice}' is not for ${playerCount} players`);
	return choice;
}
