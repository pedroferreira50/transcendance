import { describe, expect, test } from "vitest";
import { MONSTER_MIN_SPAWN_DISTANCE, SIZE_RULES, diamondCount, MAX_POWERUPS_ON_MAP } from "../config";
import { loadMap, MAPS, parseMap } from "../mapLoader";
import { distancesFrom, freeCells, placeDiamonds, placeMonsters, placePowerUp, posKey, POWERUP_TYPES } from "../placement";
import type { GameState, MapData, Player, Position } from "../types";

// Same seed -> same numbers (mulberry32)
function seeded(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const SMALL = parseMap([
	"111111111",
	"1A0000001",
	"101111101",
	"100010001",
	"10101E101",
	"100000001",
	"1000000B1",
	"111111111",
].join("\n"));

const keys = (cells: Position[]) => cells.map(posKey);
const isWall = (map: MapData, p: Position) => map.walls[p.y][p.x];

function player(slot: number, pos: Position, status: Player["status"] = "playing"): Player {
	return {
		userId: slot, username: `p${slot}`, slot, character: "goldfish", pos, spawn: pos,
		diamonds: 0, moves: 0, deaths: 0, facing: "right", status, lastMoveAt: 0, respawnAt: 0,
		invulnerableUntil: 0, frozenUntil: 0, speedUntil: 0, enchantedUntil: 0, powerUp: null, disconnectedAt: null,
	};
}

function state(map: MapData, parts: Partial<GameState> = {}): GameState {
	return {
		id: "t", mapName: "test", width: map.width, height: map.height, walls: map.walls, exit: map.exit,
		goal: 5, players: [], monsters: [], monstersFrozenUntil: 0, diamonds: [], powerUps: [],
		nextPowerUpAt: 0, endsAt: 0, status: "running", winnerSlot: null, local: false, ...parts,
	};
}

describe("distancesFrom", () => {
	test("counts the steps around the walls", () => {
		const dist = distancesFrom(SMALL, { x: 1, y: 1 });
		expect(dist.get("1,1")).toBe(0);
		expect(dist.get("7,1")).toBe(6);
		expect(dist.get("1,3")).toBe(2);
		expect(dist.get("0,0")).toBeUndefined();	// wall
	});
});

describe("freeCells", () => {
	test("skips walls, the exit, the spawns and the occupied cells", () => {
		const cells = keys(freeCells(SMALL, [{ x: 2, y: 1 }]));
		expect(cells).not.toContain("0,0");	// wall
		expect(cells).not.toContain("5,4");	// exit
		expect(cells).not.toContain("1,1");	// spawn A
		expect(cells).not.toContain("7,6");	// spawn B
		expect(cells).not.toContain("2,1");	// occupied
		expect(cells).toContain("3,1");
	});
});

describe("placeMonsters", () => {
	test("the right number, all different, far from the spawns", () => {
		const monsters = placeMonsters(SMALL, 3, seeded(1));
		expect(monsters).toHaveLength(3);
		expect(new Set(keys(monsters)).size).toBe(3);
		const fromSpawns = SMALL.spawns.map((s) => distancesFrom(SMALL, s));
		for (const m of monsters) {
			expect(isWall(SMALL, m)).toBe(false);
			expect(posKey(m)).not.toBe(posKey(SMALL.exit));
			for (const dist of fromSpawns)
				expect(dist.get(posKey(m))!).toBeGreaterThanOrEqual(MONSTER_MIN_SPAWN_DISTANCE);
		}
	});

	test("same random -> same result", () => {
		expect(placeMonsters(SMALL, 3, seeded(42))).toEqual(placeMonsters(SMALL, 3, seeded(42)));
	});

	test("throws if there is no room", () => {
		expect(() => placeMonsters(SMALL, 100, seeded(1))).toThrow("not enough free cells");
	});
});

describe("placeDiamonds", () => {
	test("the right number, all different, never on an occupied cell", () => {
		const monsters = placeMonsters(SMALL, 2, seeded(7));
		const diamonds = placeDiamonds(SMALL, 11, monsters, seeded(7));
		expect(diamonds).toHaveLength(11);
		expect(new Set(keys(diamonds)).size).toBe(11);
		for (const d of diamonds) {
			expect(isWall(SMALL, d)).toBe(false);
			expect(keys([SMALL.exit, ...SMALL.spawns, ...monsters])).not.toContain(posKey(d));
		}
	});
});

describe("placePowerUp", () => {
	test("never on a diamond, shark, power-up or living player", () => {
		const s = state(SMALL, {
			players: [player(0, { x: 3, y: 1 }), player(1, { x: 4, y: 1 }, "dead")],
			monsters: [{ x: 5, y: 1 }],
			diamonds: [{ x: 6, y: 1 }],
			powerUps: [{ type: "speed", pos: { x: 7, y: 1 } }],
		});
		for (let seed = 0; seed < 50; seed++) {
			const powerUp = placePowerUp(SMALL, s, seeded(seed))!;
			expect(["3,1", "5,1", "6,1", "7,1", "1,1", "7,6", "5,4"]).not.toContain(posKey(powerUp.pos));
			expect(isWall(SMALL, powerUp.pos)).toBe(false);
			expect(POWERUP_TYPES).toContain(powerUp.type);
		}
	});

	test("the type comes from random", () => {
		const always = (n: number) => () => n;
		expect(placePowerUp(SMALL, state(SMALL), always(0))!.type).toBe("speed");
		expect(placePowerUp(SMALL, state(SMALL), always(0.5))!.type).toBe("freeze");
		expect(placePowerUp(SMALL, state(SMALL), always(0.99))!.type).toBe("enchant");
	});

	test("null when the map is full", () => {
		expect(placePowerUp(SMALL, state(SMALL, { diamonds: freeCells(SMALL) }), seeded(1))).toBeNull();
	});
});

describe("the real maps", () => {
	for (const { name, size } of MAPS) {
		test(`${name}: worst case fits`, () => {
			const map = loadMap(name);
			const rules = SIZE_RULES[size];
			const random = seeded(123);
			const monsters = placeMonsters(map, rules.monsters, random);
			const diamonds = placeDiamonds(map, diamondCount(size, Math.max(...rules.players)), monsters, random);
			const s = state(map, { monsters, diamonds });
			for (let i = 0; i < MAX_POWERUPS_ON_MAP; i++)
				s.powerUps.push(placePowerUp(map, s, random)!);
			expect(new Set(keys([...monsters, ...diamonds, ...s.powerUps.map((p) => p.pos)])).size)
				.toBe(monsters.length + diamonds.length + MAX_POWERUPS_ON_MAP);
		});
	}
});
