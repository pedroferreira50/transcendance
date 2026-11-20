import { describe, expect, test } from "vitest";
import { chooseTarget, dangerCells, decide, distances, findPath, keyDelay, look, newMemory, wantsPowerUp } from "../bot";
import { playMatch, randomOptions } from "../botArena";
import { BOT_LEVELS, MOVE_COOLDOWN_MS, defaultOptions } from "../config";
import { readOptions } from "../gameSocket";
import { step } from "../GameRoom";
import { loadMap, parseMap } from "../mapLoader";
import { posKey } from "../placement";
import type { BotParams, Direction, GameState, MapData, Player, Position } from "../types";
import { seeded } from "./helpers";

// 1 = wall, 0 = floor, A = spawn, E = turtle (the same format as the .ber files)
function map(rows: string[]): MapData {
	return parseMap(rows.join("\n"));
}

// Where a list of directions leads, failing the test if it goes through a wall
function walk(walls: boolean[][], from: Position, path: Direction[]): Position {
	let pos = from;
	for (const dir of path) {
		pos = step(pos, dir);
		expect(walls[pos.y][pos.x]).toBe(false);
	}
	return pos;
}

const at = (x: number, y: number): Position => ({ x, y });
const only = (cells: Position[]) => (pos: Position) => cells.some((c) => c.x === pos.x && c.y === pos.y);

describe("findPath", () => {
	test("a straight line", () => {
		const m = map([
			"1111111",
			"1A000E1",
			"1111111",
		]);
		expect(findPath(m.walls, at(1, 1), at(5, 1))).toEqual(["right", "right", "right", "right"]);
	});

	test("already there: an empty path", () => {
		const m = map([
			"1111",
			"1AE1",
			"1111",
		]);
		expect(findPath(m.walls, at(1, 1), at(1, 1))).toEqual([]);
	});

	test("goes around a wall", () => {
		const m = map([
			"11111",
			"1A1E1",
			"10001",
			"11111",
		]);
		expect(findPath(m.walls, at(1, 1), at(3, 1))).toEqual(["down", "right", "right", "up"]);
	});

	test("takes the shortest of two ways", () => {
		// over the top: 4 steps; around the bottom: 8 steps
		const m = map([
			"1111111",
			"1A000E1",
			"1011101",
			"1000001",
			"1111111",
		]);
		const path = findPath(m.walls, at(1, 1), at(5, 1));
		expect(path).toHaveLength(4);
		expect(walk(m.walls, at(1, 1), path!)).toEqual(at(5, 1));
	});

	test("no way there: null", () => {
		const m = map([
			"11111",
			"1A1E1",
			"11111",
		]);
		expect(findPath(m.walls, at(1, 1), at(3, 1))).toBeNull();
	});

	test("goes around a blocked cell", () => {
		const m = map([
			"1111111",
			"1A000E1",
			"1000001",
			"1111111",
		]);
		const shark = at(3, 1);
		const path = findPath(m.walls, at(1, 1), at(5, 1), only([shark]));
		expect(path).toHaveLength(6);
		// it never steps on the shark
		let pos = at(1, 1);
		for (const dir of path!) {
			pos = step(pos, dir);
			expect(pos).not.toEqual(shark);
		}
		expect(pos).toEqual(at(5, 1));
	});

	test("the only way is blocked: null", () => {
		const m = map([
			"1111111",
			"1A000E1",
			"1111111",
		]);
		expect(findPath(m.walls, at(1, 1), at(5, 1), only([at(3, 1)]))).toBeNull();
	});

	test("the target itself can be blocked (a diamond in a dangerous cell)", () => {
		const m = map([
			"11111",
			"1A0E1",
			"11111",
		]);
		expect(findPath(m.walls, at(1, 1), at(3, 1), only([at(3, 1)]))).toEqual(["right", "right"]);
	});

	test("a position outside the map is a wall, not a crash", () => {
		const m = map([
			"111",
			"1A1",
			"1E1",
			"111",
		]);
		expect(findPath(m.walls, at(1, 1), at(9, 9))).toBeNull();
	});
});

describe("distances", () => {
	const m = map([
		"1111111",
		"1A000E1",
		"1011101",
		"1000001",
		"1111111",
	]);

	test("0 at the start and the steps to each cell", () => {
		const dist = distances(m.walls, at(1, 1));
		expect(dist.get(posKey(at(1, 1)))).toBe(0);
		expect(dist.get(posKey(at(3, 1)))).toBe(2);
		expect(dist.get(posKey(at(5, 1)))).toBe(4);
		expect(dist.get(posKey(at(3, 3)))).toBe(4);
		expect(dist.has(posKey(at(0, 0)))).toBe(false); // a wall
	});

	test("a blocked cell gets a distance, but the search does not go through it", () => {
		// the corridor at the top is cut at (3, 1): (4, 1) is now reached around the bottom, by the turtle
		const dist = distances(m.walls, at(1, 1), only([at(3, 1)]));
		expect(dist.get(posKey(at(3, 1)))).toBe(2);
		expect(dist.get(posKey(at(5, 1)))).toBe(8);
		expect(dist.get(posKey(at(4, 1)))).toBe(9);
	});

	test("agrees with findPath on a real map", () => {
		const real = loadMap("small-1");
		const from = real.spawns[0];
		const dist = distances(real.walls, from);
		for (const [key, steps] of dist) {
			const [x, y] = key.split(",").map(Number);
			const path = findPath(real.walls, from, at(x, y));
			expect(path).toHaveLength(steps);
			expect(walk(real.walls, from, path!)).toEqual(at(x, y));
		}
	});
});

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

// A match in progress on a map written by hand; the bot is slot 0, at the spawn A
function game(rows: string[], parts: Partial<GameState> = {}): GameState {
	const m = map(rows);
	return {
		id: "t", mapName: "test", width: m.width, height: m.height, walls: m.walls, exit: m.exit,
		goal: 5, players: [fish(0, m.spawns[0])], monsters: [], monstersFrozenUntil: 0, diamonds: [], powerUps: [],
		nextPowerUpAt: 0, endsAt: 600_000, startedAt: 0, endedAt: null, status: "running", winnerSlot: null,
		endReason: null, local: false, ...parts,
	};
}

function fish(slot: number, pos: Position, parts: Partial<Player> = {}): Player {
	return {
		userId: slot, username: `p${slot}`, slot, character: "goldfish", pos, spawn: pos,
		diamonds: 0, moves: 0, deaths: 0, facing: "right", status: "playing", lastMoveAt: 0, respawnAt: 0,
		invulnerableUntil: 0, frozenUntil: 0, speedUntil: 0, enchantedUntil: 0, powerUp: null, powerUpsUsed: 0, disconnectedAt: null, ...parts,
	};
}

// A careful bot without randomness: looks every time, never makes a mistake, never hesitates
const CAREFUL: BotParams = { lookMs: 0, stepMs: 100, mistake: 0, safety: 1, stubborn: 0, tactics: true };
const OPTIONS = defaultOptions();
const MIDDLE = () => 0.5;
const keySet = (cells: Position[]) => new Set(cells.map(posKey));

// an open room of 5 x 5 cells, the bot in the corner (1, 1) and the turtle in the other one (5, 5)
const ROOM = [
	"1111111",
	"1A00001",
	"1000001",
	"1000001",
	"1000001",
	"10000E1",
	"1111111",
];

describe("look", () => {
	test("is a copy: what changes later in the match is not seen", () => {
		const state = game(ROOM, { monsters: [at(3, 3)], diamonds: [at(2, 2)] });
		const view = look(state, 0, 1000);
		state.monsters[0] = at(4, 4);
		state.diamonds.pop();
		expect(view.at).toBe(1000);
		expect(view.monsters).toEqual([at(3, 3)]);
		expect(view.diamonds).toEqual([at(2, 2)]);
		expect(view.others).toEqual([]);
	});
});

describe("dangerCells", () => {
	const state = game(ROOM, { monsters: [at(3, 3)] });
	const me = state.players[0];

	test("safety 1, just looked: the shark and the cells next to it", () => {
		const view = look(state, 0, 0);
		expect(dangerCells(state, me, view, 0, 1, OPTIONS)).toEqual(keySet([at(3, 3), at(2, 3), at(4, 3), at(3, 2), at(3, 4)]));
	});

	test("grows with the time since the last look, faster with fast sharks", () => {
		const view = look(state, 0, 0);
		// 1 s with normal sharks (500 ms a step): 2 more cells -> radius 3, the room minus its 4 corners
		expect(dangerCells(state, me, view, 1000, 1, OPTIONS).size).toBe(21);
		// 1 s with fast sharks (300 ms a step): 3 more cells -> radius 4, the whole room but the turtle
		expect(dangerCells(state, me, view, 1000, 1, { ...OPTIONS, sharks: "fast" }).size).toBe(24);
	});

	test("frozen sharks: only their own cells; enchanted: nothing", () => {
		const frozen = look(game(ROOM, { monsters: [at(3, 3)], monstersFrozenUntil: 2000 }), 0, 0);
		expect(dangerCells(state, me, frozen, 1000, 1, OPTIONS)).toEqual(keySet([at(3, 3)]));
		const enchanted = fish(0, at(1, 1), { enchantedUntil: 5000 });
		expect(dangerCells(state, enchanted, look(state, 0, 0), 0, 1, OPTIONS).size).toBe(0);
	});

	test("the turtle is never dangerous (sharks do not go in it)", () => {
		const near = game(ROOM, { monsters: [at(5, 4)] });
		expect(dangerCells(near, near.players[0], look(near, 0, 0), 0, 1, OPTIONS).has(posKey(near.exit))).toBe(false);
	});
});

describe("chooseTarget", () => {
	function target(state: GameState): Position | null {
		const me = state.players[0];
		const view = look(state, 0, 0);
		const danger = dangerCells(state, me, view, 0, 1, OPTIONS);
		return chooseTarget(state, me, view, distances(state.walls, me.pos, (p) => danger.has(posKey(p))), danger);
	}

	test("the closest diamond by the real path, not in a straight line", () => {
		// (3, 1) is 2 cells away in a straight line but 8 steps around the walls; (2, 4) is 4 steps away
		const state = game([
			"111111",
			"1A1001",
			"101101",
			"100001",
			"1000E1",
			"111111",
		], { diamonds: [at(3, 1), at(2, 4)] });
		expect(target(state)).toEqual(at(2, 4));
	});

	test("with all the diamonds: the turtle", () => {
		const state = game(ROOM, { diamonds: [at(2, 1)] });
		state.players[0].diamonds = state.goal;
		expect(target(state)).toEqual(state.exit);
	});

	const LONG = [
		"111111111",
		"1A0000001",
		"100000001",
		"1000000E1",
		"111111111",
	];

	test("a power-up close enough is worth the detour; a far one is not", () => {
		expect(target(game(LONG, { diamonds: [at(3, 1)], powerUps: [{ type: "speed", pos: at(5, 1) }] }))).toEqual(at(5, 1));
		expect(target(game(LONG, { diamonds: [at(3, 1)], powerUps: [{ type: "speed", pos: at(7, 2) }] }))).toEqual(at(3, 1));
		// holding one already: it can not take another
		const holding = game(LONG, { diamonds: [at(3, 1)], powerUps: [{ type: "speed", pos: at(5, 1) }] });
		holding.players[0].powerUp = "freeze";
		expect(target(holding)).toEqual(at(3, 1));
	});

	test("leaves a diamond to a rival who is closer to it", () => {
		// both diamonds are 2 steps away, but the rival at (4, 1) is 1 step from (3, 1)
		const state = game(LONG, { diamonds: [at(3, 1), at(1, 3)] });
		state.players.push(fish(1, at(4, 1)));
		expect(target(state)).toEqual(at(1, 3));
	});
});

describe("wantsPowerUp", () => {
	const longPath: Direction[] = Array(10).fill("right");
	const shortPath: Direction[] = ["right", "right"];

	function holding(type: "speed" | "freeze" | "enchant", parts: Partial<GameState> = {}) {
		const state = game(ROOM, parts);
		state.players[0].powerUp = type;
		return { state, me: state.players[0], view: look(state, 0, 0) };
	}

	test("EASY uses it as soon as it has one", () => {
		const { state, me, view } = holding("freeze");
		expect(wantsPowerUp(state, me, view, 0, BOT_LEVELS.easy, shortPath, shortPath, new Set())).toBe(true);
	});

	test("speed on a long way, not on a short one", () => {
		const { state, me, view } = holding("speed");
		expect(wantsPowerUp(state, me, view, 0, CAREFUL, longPath, longPath, new Set())).toBe(true);
		expect(wantsPowerUp(state, me, view, 0, CAREFUL, shortPath, shortPath, new Set())).toBe(false);
	});

	test("freeze when a rival with all the diamonds is close to the turtle, or a shark touches the bot", () => {
		const rival = holding("freeze");
		rival.state.players.push(fish(1, at(5, 3), { diamonds: 5 }));
		expect(wantsPowerUp(rival.state, rival.me, look(rival.state, 0, 0), 0, CAREFUL, shortPath, shortPath, new Set())).toBe(true);
		const shark = holding("freeze", { monsters: [at(2, 1)] });
		expect(wantsPowerUp(shark.state, shark.me, shark.view, 0, CAREFUL, shortPath, shortPath, new Set())).toBe(true);
		const calm = holding("freeze", { monsters: [at(5, 1)] });
		expect(wantsPowerUp(calm.state, calm.me, calm.view, 0, CAREFUL, shortPath, shortPath, new Set())).toBe(false);
	});

	test("enchant when the only way goes between the sharks", () => {
		const { state, me, view } = holding("enchant");
		expect(wantsPowerUp(state, me, view, 0, CAREFUL, null, shortPath, new Set())).toBe(true);
		expect(wantsPowerUp(state, me, view, 0, CAREFUL, shortPath, shortPath, new Set())).toBe(false);
	});
});

describe("decide", () => {
	// two ways from (1, 1) to the diamond at (5, 1): along the top (4 steps) or around the bottom (8 steps)
	const LOOP = [
		"1111111",
		"1A00001",
		"1011101",
		"10000E1",
		"1111111",
	];

	test("walks the shortest safe way: the top, or around the bottom when a shark is on the top", () => {
		expect(decide(game(LOOP, { diamonds: [at(5, 1)] }), 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).dir).toBe("right");
		const shark = game(LOOP, { diamonds: [at(5, 1)], monsters: [at(3, 1)] });
		expect(decide(shark, 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).dir).toBe("down");
	});

	test("enchanted: it goes straight through the sharks", () => {
		const state = game(LOOP, { diamonds: [at(5, 1)], monsters: [at(3, 1)] });
		state.players[0].enchantedUntil = 5000;
		expect(decide(state, 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).dir).toBe("right");
	});

	// one corridor: the only way to the diamond at (5, 1) passes the shark at (4, 1)
	const CORRIDOR = [
		"11111111",
		"1A0000E1",
		"11111111",
	];

	test("no safe way: it waits for the shark to pass", () => {
		const state = game(CORRIDOR, { diamonds: [at(5, 1)], monsters: [at(4, 1)] });
		expect(decide(state, 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).dir).toBeNull();
	});

	test("a shark coming to its cell: it steps away", () => {
		const state = game(CORRIDOR, { diamonds: [at(5, 1)], monsters: [at(4, 1)] });
		state.players[0].pos = at(3, 1);
		expect(decide(state, 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).dir).toBe("left");
	});

	test("a mistake is a random step, but never into a wall or onto a shark", () => {
		const clumsy = { ...CAREFUL, mistake: 1 };
		const state = game(ROOM, { diamonds: [at(5, 1)], monsters: [at(1, 2)] });
		const random = seeded(7);
		const seen = new Set<Direction | null>();
		for (let i = 0; i < 50; i++) {
			const { dir } = decide(state, 0, 0, newMemory(), clumsy, OPTIONS, random);
			seen.add(dir);
			expect(dir).not.toBeNull();
			const to = step(at(1, 1), dir!);
			expect(state.walls[to.y][to.x]).toBe(false);
			expect(to).not.toEqual(at(1, 2));
		}
		expect(seen).toEqual(new Set(["right"])); // up and left are walls, down is the shark
	});

	test("it does not look again before lookMs: it decides with what it saw", () => {
		const slow = { ...CAREFUL, lookMs: 1000 };
		const state = game(LOOP, { diamonds: [at(5, 1)] });
		const memory = newMemory();
		decide(state, 0, 0, memory, slow, OPTIONS, MIDDLE);
		state.monsters = [at(3, 1)]; // a shark arrives, but the bot has not looked yet
		expect(decide(state, 0, 500, memory, slow, OPTIONS, MIDDLE).dir).toBe("right");
		expect(memory.view!.at).toBe(0);
		expect(decide(state, 0, 1000, memory, slow, OPTIONS, MIDDLE).dir).toBe("down"); // now it sees it
		expect(memory.view!.at).toBe(1000);
	});

	test("asks for its power-up when it is the moment", () => {
		const state = game(CORRIDOR, { diamonds: [at(5, 1)], monsters: [at(4, 1)] });
		state.players[0].powerUp = "enchant";
		expect(decide(state, 0, 0, newMemory(), CAREFUL, OPTIONS, MIDDLE).usePowerUp).toBe(true);
	});

	test("does nothing when dead, frozen or after the end; when dead it looks again on its way back", () => {
		const memory = newMemory();
		const state = game(ROOM, { diamonds: [at(5, 1)] });
		decide(state, 0, 0, memory, CAREFUL, OPTIONS, MIDDLE);
		state.players[0].status = "dead";
		expect(decide(state, 0, 0, memory, CAREFUL, OPTIONS, MIDDLE)).toEqual({ dir: null, usePowerUp: false });
		expect(memory.view).toBeNull();
		state.players[0].status = "playing";
		state.players[0].frozenUntil = 2000;
		expect(decide(state, 0, 1000, memory, CAREFUL, OPTIONS, MIDDLE).dir).toBeNull();
		state.players[0].frozenUntil = 0;
		state.status = "finished";
		expect(decide(state, 0, 1000, memory, CAREFUL, OPTIONS, MIDDLE).dir).toBeNull();
	});
});

describe("keyDelay", () => {
	test("twice as fast while the speed power-up lasts, like a person pressing faster", () => {
		const me = fish(0, at(1, 1), { speedUntil: 5000 });
		expect(keyDelay(me, 4999, CAREFUL)).toBe(CAREFUL.stepMs / 2);
		expect(keyDelay(me, 5000, CAREFUL)).toBe(CAREFUL.stepMs);
		expect(keyDelay(undefined, 0, CAREFUL)).toBe(CAREFUL.stepMs);
	});

	test("even with speed, HARD is never faster than the server lets a fish move", () => {
		for (const params of Object.values(BOT_LEVELS))
			expect(params.stepMs / 2).toBeGreaterThanOrEqual(MOVE_COOLDOWN_MS / 2);
	});
});

describe("arena (bot against bot)", () => {
	test("a whole match ends, and the numbers agree with the result", () => {
		const match = playMatch(["normal", "hard"], "small-1", defaultOptions(), seeded(5));
		expect(["exit", "timeout"]).toContain(match.endReason);
		const results = match.fish.map((f) => f.result).sort();
		if (match.endReason === "exit") {
			expect(results).toEqual(["loss", "win"]);
			expect(match.fish.find((f) => f.result === "win")!.diamonds).toBe(5); // small map: the goal is 5
		} else
			expect([["draw", "draw"], ["loss", "win"]]).toContainEqual(results); // the time ran out
		expect(match.durationMs).toBeGreaterThan(0);
	});

	test("the random options are always options the server accepts", () => {
		const random = seeded(9);
		for (let i = 0; i < 30; i++) {
			const options = randomOptions(random);
			expect(readOptions(options)).toEqual(options);
		}
	});
});
