import fs from "node:fs";
import path from "node:path";
import type { MapData, Position } from "./types";

const MAPS_DIR = path.join(__dirname, "..", "..", "maps");

export type PlayerCount = 2 | 3 | 4;

export const MAPS_BY_SIZE: Record<PlayerCount, string[]> = {
	2: ["small-1", "small-2"],
	3: ["medium-1", "medium-2"],
	4: ["large-1", "large-2"],
};

const SPAWN_CHARS = "ABCD";
const COIN_CHARS = "abcd";

// Turns the text of a .ber file into MapData.
export function parseMap(text: string): MapData {
	const rows = text.split(/\r?\n/).filter((row) => row.length > 0);
	if (rows.length === 0)
		throw new Error("map is empty");
	const width = rows[0].length;
	const height = rows.length;

	const walls: boolean[][] = [];
	let exit: Position | null = null;
	const spawns: (Position | undefined)[] = [];
	const coins: MapData["coins"] = [];
	const monsters: Position[] = [];
	const freezeSpots: Position[] = [];

	for (let y = 0; y < height; y++) {
		if (rows[y].length !== width)
			throw new Error(`row ${y} has ${rows[y].length} columns, expected ${width}`);
		walls.push([]);
		for (let x = 0; x < width; x++) {
			const ch = rows[y][x];
			const pos = { x, y };
			walls[y].push(ch === "1");
			if (ch === "1" || ch === "0")
				continue;
			if (ch === "E") {
				if (exit)
					throw new Error("map has more than one exit");
				exit = pos;
			} else if (ch === "X") {
				monsters.push(pos);
			} else if (ch === "*") {
				freezeSpots.push(pos);
			} else if (SPAWN_CHARS.includes(ch)) {
				const slot = SPAWN_CHARS.indexOf(ch);
				if (spawns[slot])
					throw new Error(`spawn ${ch} appears more than once`);
				spawns[slot] = pos;
			} else if (COIN_CHARS.includes(ch)) {
				coins.push({ owner: COIN_CHARS.indexOf(ch), pos });
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

	return { width, height, walls, exit, spawns: spawns as Position[], coins, monsters, freezeSpots };
}

// Reads backend/maps/<name>.ber.
export function loadMap(name: string): MapData {
	if (!/^[a-z0-9-]+$/.test(name))
		throw new Error(`invalid map name '${name}'`);
	return parseMap(fs.readFileSync(path.join(MAPS_DIR, `${name}.ber`), "utf8"));
}

// Chooses the map for a match or a random one of the right size
export function pickMap(playerCount: PlayerCount, choice: string, random: () => number): string {
	const options = MAPS_BY_SIZE[playerCount];
	if (!options)
		throw new Error(`no maps for ${playerCount} players`);
	if (choice === "random")
		return options[Math.floor(random() * options.length)];
	if (!options.includes(choice))
		throw new Error(`map '${choice}' is not for ${playerCount} players`);
	return choice;
}
