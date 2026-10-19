import { describe, expect, test } from "vitest";
import { MAX_POWERUPS_ON_MAP, MONSTER_MIN_SPAWN_DISTANCE, SIZE_RULES, diamondCount } from "../config";
import { loadMap, MAPS } from "../mapLoader";
import { distancesFrom, posKey } from "../placement";
import type { MapData, Position } from "../types";

function floorCells(map: MapData): Position[] {
	const cells: Position[] = [];
	for (let y = 0; y < map.height; y++)
		for (let x = 0; x < map.width; x++)
			if (!map.walls[y][x])
				cells.push({ x, y });
	return cells;
}

// The minimum "validation" of our 6 hand-made maps.
for (const { name, size } of MAPS) {
	describe(name, () => {
		const map = loadMap(name);
		const rules = SIZE_RULES[size];
		const maxPlayers = Math.max(...rules.players);

		test("is closed by walls", () => {
			for (let x = 0; x < map.width; x++)
				expect(map.walls[0][x] && map.walls[map.height - 1][x]).toBe(true);
			for (let y = 0; y < map.height; y++)
				expect(map.walls[y][0] && map.walls[y][map.width - 1]).toBe(true);
		});

		test(`has ${maxPlayers} spawns`, () => {
			expect(map.spawns).toHaveLength(maxPlayers);
		});

		test("the turtle can only be entered from above or below", () => {
			const { x, y } = map.exit;
			expect(map.walls[y][x - 1]).toBe(true);
			expect(map.walls[y][x + 1]).toBe(true);
			expect(map.walls[y - 1][x]).toBe(false);
			expect(map.walls[y + 1][x]).toBe(false);
			for (const dx of [-1, 1])
				for (const dy of [-1, 1])
					expect(map.walls[y + dy][x + dx]).toBe(false);
		});

		test("every floor cell can be reached", () => {
			expect(distancesFrom(map, map.exit).size).toBe(floorCells(map).length);
		});

		test("every spawn is at the same distance from the turtle", () => {
			const dist = distancesFrom(map, map.exit);
			const fromSpawns = map.spawns.map((s) => dist.get(posKey(s)));
			expect(new Set(fromSpawns).size).toBe(1);
		});

		test("has room for the worst case", () => {
			// free = floor without the turtle and the spawns
			const free = floorCells(map).length - 1 - map.spawns.length;
			expect(free).toBeGreaterThanOrEqual(diamondCount(size, maxPlayers) + rules.monsters + MAX_POWERUPS_ON_MAP);

			const fromSpawns = map.spawns.map((s) => distancesFrom(map, s));
			const farFromSpawns = floorCells(map).filter((c) =>
				fromSpawns.every((d) => d.get(posKey(c))! >= MONSTER_MIN_SPAWN_DISTANCE));
			expect(farFromSpawns.length).toBeGreaterThanOrEqual(rules.monsters);
		});
	});
}
