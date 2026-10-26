import { describe, expect, test } from "vitest";
import { MAX_POWERUPS_ON_MAP, POWERUP_INTERVAL_MS, RECONNECT_TIMEOUT_MS, SIZE_RULES, diamondCount } from "../config";
import { GameRoom, type PlayerInfo } from "../GameRoom";
import { loadMap } from "../mapLoader";
import { posKey } from "../placement";
import type { Direction } from "../types";
import { seeded } from "./helpers";

const TWO: PlayerInfo[] = [
	{ userId: 1, username: "ana", character: "goldfish" },
	{ userId: 2, username: "bia", character: "betta" },
];

function room(players = TWO, random = seeded(1)): GameRoom {
	return new GameRoom("r1", "small-1", loadMap("small-1"), "small", players, { local: false, random });
}

describe("constructor", () => {
	test("puts each player on their spawn, in slot order", () => {
		const r = room();
		const map = loadMap("small-1");
		expect(r.state.players.map((p) => p.slot)).toEqual([0, 1]);
		expect(r.state.players.map((p) => p.username)).toEqual(["ana", "bia"]);
		for (const p of r.state.players) {
			expect(p.pos).toEqual(map.spawns[p.slot]);
			expect(p.spawn).toEqual(map.spawns[p.slot]);
			expect(p.status).toBe("playing");
			expect(p.diamonds).toBe(0);
			expect(p.powerUp).toBeNull();
		}
	});

	test("pos is a copy of spawn", () => {
		const p = room().state.players[0];
		expect(p.pos).not.toBe(p.spawn);
	});

	test("places the sharks and goal * players + 1 diamonds, never on the same cell", () => {
		const r = room();
		expect(r.state.goal).toBe(SIZE_RULES.small.goal);
		expect(r.state.monsters).toHaveLength(SIZE_RULES.small.monsters);
		expect(r.state.diamonds).toHaveLength(diamondCount("small", 2));
		const all = [...r.state.monsters, ...r.state.diamonds].map(posKey);
		expect(new Set(all).size).toBe(all.length);
	});

	test("starts in countdown, with nothing on the clock", () => {
		const r = room();
		expect(r.state.status).toBe("countdown");
		expect(r.state.powerUps).toEqual([]);
		expect(r.state.winnerSlot).toBeNull();
		expect(r.dirty).toBe(false);
	});

	test("refuses a number of players the size does not accept", () => {
		expect(() => room([TWO[0]])).toThrow("does not accept 1 players");
	});
});

describe("start", () => {
	test("starts the clock and the power-up timer", () => {
		const r = room();
		r.start(1000);
		expect(r.state.status).toBe("running");
		expect(r.state.endsAt).toBe(1000 + SIZE_RULES.small.timeLimitMs);
		expect(r.state.nextPowerUpAt).toBe(1000 + POWERUP_INTERVAL_MS);
		expect(r.dirty).toBe(true);
	});

	test("a second start does nothing", () => {
		const r = room();
		r.start(1000);
		r.start(5000);
		expect(r.state.endsAt).toBe(1000 + SIZE_RULES.small.timeLimitMs);
	});
});

// small-1: A starts at (1,1), the turtle is at (9,4) and is entered from (9,3)
// The test removes the random sharks and diamonds and puts its own by hand
function running(now = 1000, random = seeded(1)): GameRoom {
	const r = room(TWO, random);
	r.state.monsters = [];
	r.state.diamonds = [];
	r.start(now);
	r.dirty = false;
	return r;
}

describe("move", () => {
	test("does not move before start", () => {
		const r = room();
		r.move(0, "right", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 1, y: 1 });
	});

	test("moves one cell and counts the move", () => {
		const r = running();
		r.move(0, "right", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 2, y: 1 });
		expect(r.state.players[0].moves).toBe(1);
		expect(r.dirty).toBe(true);
	});

	test("a wall blocks, but the player still turns", () => {
		const r = running();
		r.move(0, "up", 1000);
		r.move(0, "left", 1200);
		expect(r.state.players[0].pos).toEqual({ x: 1, y: 1 });
		expect(r.state.players[0].moves).toBe(0);
		expect(r.state.players[0].facing).toBe("left");
	});

	test("cooldown: 100 ms apart -> only the first, 150 ms -> both", () => {
		const r = running();
		r.move(0, "right", 1000);
		r.move(0, "right", 1100);
		expect(r.state.players[0].pos).toEqual({ x: 2, y: 1 });
		r.move(0, "right", 1150);
		expect(r.state.players[0].pos).toEqual({ x: 3, y: 1 });
	});

	test("speed: 75 ms apart is enough", () => {
		const r = running();
		r.state.players[0].speedUntil = 5000;
		r.move(0, "right", 1000);
		r.move(0, "right", 1075);
		expect(r.state.players[0].pos).toEqual({ x: 3, y: 1 });
	});

	test("frozen players do not move", () => {
		const r = running();
		r.state.players[0].frozenUntil = 3000;
		r.move(0, "right", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 1, y: 1 });
		r.move(0, "right", 3000);
		expect(r.state.players[0].pos).toEqual({ x: 2, y: 1 });
	});

	test("a living player blocks, a dead one does not", () => {
		const r = running();
		r.state.players[1].pos = { x: 2, y: 1 };
		r.move(0, "right", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 1, y: 1 });
		r.state.players[1].status = "dead";
		r.move(0, "right", 1200);
		expect(r.state.players[0].pos).toEqual({ x: 2, y: 1 });
	});

	test("dead players do not move", () => {
		const r = running();
		r.state.players[0].status = "dead";
		r.move(0, "right", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 1, y: 1 });
	});

	test("picks a diamond, but not after reaching the goal", () => {
		const r = running();
		r.state.diamonds = [{ x: 2, y: 1 }, { x: 3, y: 1 }];
		r.move(0, "right", 1000);
		expect(r.state.players[0].diamonds).toBe(1);
		expect(r.state.diamonds).toEqual([{ x: 3, y: 1 }]);
		r.state.players[0].diamonds = r.state.goal;
		r.move(0, "right", 1200);
		expect(r.state.players[0].diamonds).toBe(r.state.goal);
		expect(r.state.diamonds).toEqual([{ x: 3, y: 1 }]);
	});

	test("picks a power-up, but only holds one", () => {
		const r = running();
		r.state.powerUps = [{ type: "speed", pos: { x: 2, y: 1 } }, { type: "freeze", pos: { x: 3, y: 1 } }];
		r.move(0, "right", 1000);
		expect(r.state.players[0].powerUp).toBe("speed");
		r.move(0, "right", 1200);
		expect(r.state.players[0].powerUp).toBe("speed");
		expect(r.state.powerUps).toEqual([{ type: "freeze", pos: { x: 3, y: 1 } }]);
	});

	test("walking into a shark kills", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.move(0, "right", 1000);
		const p = r.state.players[0];
		expect(p.status).toBe("dead");
		expect(p.deaths).toBe(1);
		expect(p.respawnAt).toBe(1000 + 3000);
	});

	test("dying keeps the diamonds, but loses the power-up", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.state.players[0].diamonds = 3;
		r.state.players[0].powerUp = "enchant";
		r.move(0, "right", 1000);
		expect(r.state.players[0].diamonds).toBe(3);
		expect(r.state.players[0].powerUp).toBeNull();
	});

	test("invulnerable or enchanted players do not die", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }, { x: 3, y: 1 }];
		r.state.players[0].invulnerableUntil = 2000;
		r.state.players[0].enchantedUntil = 3000;
		r.move(0, "right", 1000);
		r.move(0, "right", 2500);
		expect(r.state.players[0].status).toBe("playing");
	});

	test("the turtle without the goal does not end the match", () => {
		const r = running();
		r.state.players[0].pos = { x: 9, y: 3 };
		r.state.players[0].diamonds = r.state.goal - 1;
		r.move(0, "down", 1000);
		expect(r.state.players[0].pos).toEqual({ x: 9, y: 4 });
		expect(r.state.status).toBe("running");
	});

	test("the turtle with the goal ends the match, and then nothing moves", () => {
		const r = running();
		r.state.players[0].pos = { x: 9, y: 3 };
		r.state.players[0].diamonds = r.state.goal;
		r.move(0, "down", 1000);
		expect(r.state.status).toBe("finished");
		expect(r.state.winnerSlot).toBe(0);
		expect(r.state.endReason).toBe("exit");
		r.move(1, "left", 2000);
		expect(r.state.players[1].moves).toBe(0);
	});
});

// A random() that always sends the sharks the same way (index in DIRECTIONS = value * 4)
function always(dir: Direction): () => number {
	return () => ({ up: 0, down: 0.25, left: 0.5, right: 0.75 })[dir];
}

describe("tickMonsters", () => {
	test("does nothing before start", () => {
		const r = room(TWO, always("right"));
		const before = [...r.state.monsters];
		r.tickMonsters(1000);
		expect(r.state.monsters).toEqual(before);
	});

	test("each shark takes one step in the random direction", () => {
		const r = running(1000, always("right"));
		r.state.monsters = [{ x: 3, y: 3 }];
		r.tickMonsters(1500);
		expect(r.state.monsters).toEqual([{ x: 4, y: 3 }]);
		expect(r.dirty).toBe(true);
	});

	test("walls, the turtle and other sharks block", () => {
		const r = running(1000, always("down"));
		r.state.monsters = [{ x: 1, y: 7 }, { x: 9, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }];
		r.tickMonsters(1500);
		// wall below (1,7), turtle below (9,3), shark below (1,3); only (1,4) moves
		expect(r.state.monsters).toEqual([{ x: 1, y: 7 }, { x: 9, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 5 }]);
	});

	test("passes over diamonds and power-ups without taking them", () => {
		const r = running(1000, always("right"));
		r.state.monsters = [{ x: 3, y: 3 }];
		r.state.diamonds = [{ x: 4, y: 3 }];
		r.state.powerUps = [{ type: "speed", pos: { x: 5, y: 3 } }];
		r.tickMonsters(1500);
		r.tickMonsters(2000);
		expect(r.state.monsters).toEqual([{ x: 5, y: 3 }]);
		expect(r.state.diamonds).toEqual([{ x: 4, y: 3 }]);
		expect(r.state.powerUps).toHaveLength(1);
	});

	test("a shark walking into a player kills", () => {
		const r = running(1000, always("left"));
		r.state.monsters = [{ x: 2, y: 1 }];
		r.tickMonsters(1500);
		expect(r.state.players[0].status).toBe("dead");
		expect(r.state.players[0].respawnAt).toBe(1500 + 3000);
	});

	test("an enchanted player survives the shark", () => {
		const r = running(1000, always("left"));
		r.state.monsters = [{ x: 2, y: 1 }];
		r.state.players[0].enchantedUntil = 6000;
		r.tickMonsters(1500);
		expect(r.state.players[0].status).toBe("playing");
	});

	test("frozen sharks do not move, but still kill", () => {
		const r = running(1000, always("right"));
		r.state.monsters = [{ x: 3, y: 3 }];
		r.state.monstersFrozenUntil = 3000;
		r.tickMonsters(1500);
		expect(r.state.monsters).toEqual([{ x: 3, y: 3 }]);
		r.state.players[0].pos = { x: 2, y: 3 };
		r.move(0, "right", 2000);
		expect(r.state.players[0].status).toBe("dead");
		r.tickMonsters(3000);
		expect(r.state.monsters).toEqual([{ x: 4, y: 3 }]);
	});
});

// B starts at (17,7)
describe("usePowerUp", () => {
	test("does nothing without a power-up, before start, frozen or dead", () => {
		const r = room();
		r.state.players[0].powerUp = "speed";
		r.usePowerUp(0, 1000);
		expect(r.state.players[0].powerUp).toBe("speed");

		const s = running();
		s.usePowerUp(0, 1000);
		expect(s.dirty).toBe(false);
		s.state.players[0].powerUp = "speed";
		s.state.players[0].frozenUntil = 2000;
		s.usePowerUp(0, 1000);
		s.state.players[1].powerUp = "speed";
		s.state.players[1].status = "dead";
		s.usePowerUp(1, 1000);
		expect(s.state.players.map((p) => p.powerUp)).toEqual(["speed", "speed"]);
	});

	test("speed: half the cooldown for 5 s, then back to normal", () => {
		const r = running();
		r.state.players[0].powerUp = "speed";
		r.usePowerUp(0, 1000);
		expect(r.state.players[0].powerUp).toBeNull();
		expect(r.state.players[0].speedUntil).toBe(6000);
		r.move(0, "right", 1000);
		r.move(0, "right", 1075);
		expect(r.state.players[0].pos).toEqual({ x: 3, y: 1 });
		r.move(0, "right", 6000);
		r.move(0, "right", 6075);
		expect(r.state.players[0].pos).toEqual({ x: 4, y: 1 });
	});

	test("freeze: the others and the sharks stop for 2 s, the user still moves", () => {
		const r = running(1000, always("right"));
		r.state.monsters = [{ x: 3, y: 3 }];
		r.state.players[0].powerUp = "freeze";
		r.usePowerUp(0, 1000);
		expect(r.state.players[0].powerUp).toBeNull();

		r.move(1, "left", 1500);
		r.tickMonsters(1500);
		r.move(0, "right", 1500);
		expect(r.state.players[1].pos).toEqual({ x: 17, y: 7 });
		expect(r.state.monsters).toEqual([{ x: 3, y: 3 }]);
		expect(r.state.players[0].pos).toEqual({ x: 2, y: 1 });

		r.move(1, "left", 3000);
		r.tickMonsters(3000);
		expect(r.state.players[1].pos).toEqual({ x: 16, y: 7 });
		expect(r.state.monsters).toEqual([{ x: 4, y: 3 }]);
	});

	test("freeze does not touch dead players", () => {
		const r = running();
		r.state.players[1].status = "dead";
		r.state.players[0].powerUp = "freeze";
		r.usePowerUp(0, 1000);
		expect(r.state.players[1].frozenUntil).toBe(0);
	});

	test("enchant: sharks do not kill for 5 s, then they do", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }, { x: 4, y: 1 }];
		r.state.players[0].powerUp = "enchant";
		r.usePowerUp(0, 1000);
		expect(r.state.players[0].enchantedUntil).toBe(6000);
		r.move(0, "right", 1000);
		expect(r.state.players[0].status).toBe("playing");
		r.move(0, "right", 5000);
		r.move(0, "right", 6000);
		expect(r.state.players[0].status).toBe("dead");
	});
});

const THREE: PlayerInfo[] = [...TWO, { userId: 3, username: "caio", character: "angler" }];

// medium-1 accepts 3 players
function runningThree(): GameRoom {
	const r = new GameRoom("r2", "medium-1", loadMap("medium-1"), "medium", THREE, { local: false, random: seeded(1) });
	r.state.monsters = [];
	r.state.diamonds = [];
	r.start(1000);
	return r;
}

describe("tickSecond", () => {
	const END = 1000 + SIZE_RULES.small.timeLimitMs;

	test("nothing ends before the time", () => {
		const r = running();
		r.tickSecond(END - 1);
		expect(r.state.status).toBe("running");
	});

	test("time is up -> the one with the most diamonds wins", () => {
		const r = running();
		r.state.players[1].diamonds = 2;
		r.tickSecond(END);
		expect(r.state.status).toBe("finished");
		expect(r.state.winnerSlot).toBe(1);
		expect(r.state.endReason).toBe("timeout");
	});

	test("time is up with a tie at the top -> nobody wins", () => {
		const r = runningThree();
		r.state.players[0].diamonds = 4;
		r.state.players[1].diamonds = 4;
		r.state.players[2].diamonds = 1;
		r.tickSecond(r.state.endsAt);
		expect(r.state.status).toBe("finished");
		expect(r.state.winnerSlot).toBeNull();
	});

	test("a player who left cannot win on time", () => {
		const r = runningThree();
		r.state.players[0].diamonds = 9;
		r.state.players[0].status = "left";
		r.state.players[1].diamonds = 3;
		r.tickSecond(r.state.endsAt);
		expect(r.state.winnerSlot).toBe(1);
	});

	test("the dead respawn after 3 s, on the spawn, invulnerable for 1 s", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.move(0, "right", 1000);
		r.tickSecond(3999);
		expect(r.state.players[0].status).toBe("dead");
		r.tickSecond(4000);
		const p = r.state.players[0];
		expect(p.status).toBe("playing");
		expect(p.pos).toEqual({ x: 1, y: 1 });
		expect(p.invulnerableUntil).toBe(5000);
	});

	test("the respawn waits while a player or a shark is on the spawn", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.move(0, "right", 1000);
		r.state.players[1].pos = { x: 1, y: 1 };
		r.tickSecond(4000);
		expect(r.state.players[0].status).toBe("dead");
		r.state.players[1].pos = { x: 1, y: 2 };
		r.state.monsters = [{ x: 1, y: 1 }];
		r.tickSecond(5000);
		expect(r.state.players[0].status).toBe("dead");
		r.state.monsters = [];
		r.tickSecond(6000);
		expect(r.state.players[0].status).toBe("playing");
	});

	test("a power-up every 5 s, at most 3 on the map", () => {
		const r = running();
		r.tickSecond(1000 + POWERUP_INTERVAL_MS - 1);
		expect(r.state.powerUps).toHaveLength(0);
		for (let i = 1; i <= MAX_POWERUPS_ON_MAP + 1; i++)
			r.tickSecond(1000 + i * POWERUP_INTERVAL_MS);
		expect(r.state.powerUps).toHaveLength(MAX_POWERUPS_ON_MAP);
		expect(r.state.nextPowerUpAt).toBe(1000 + (MAX_POWERUPS_ON_MAP + 2) * POWERUP_INTERVAL_MS);
	});

	test("after the end nothing changes", () => {
		const r = running();
		r.tickSecond(END);
		r.state.players[0].status = "dead";
		r.tickSecond(END + 10_000);
		expect(r.state.players[0].status).toBe("dead");
		expect(r.state.powerUps).toHaveLength(0);
	});
});

describe("leave", () => {
	test("with 2 players, the other one wins", () => {
		const r = running();
		r.leave(0);
		expect(r.state.players[0].status).toBe("left");
		expect(r.state.status).toBe("finished");
		expect(r.state.winnerSlot).toBe(1);
		expect(r.state.endReason).toBe("forfeit");
	});

	test("with 3 players, the match goes on until only 1 is left", () => {
		const r = runningThree();
		r.leave(0);
		expect(r.state.status).toBe("running");
		r.leave(0);
		expect(r.state.status).toBe("running");
		r.leave(1);
		expect(r.state.winnerSlot).toBe(2);
	});

	test("also works during the countdown", () => {
		const r = room();
		r.leave(1);
		expect(r.state.status).toBe("finished");
		expect(r.state.winnerSlot).toBe(0);
	});

	test("a player who left blocks nothing", () => {
		const r = runningThree();
		r.state.players[1].pos = { ...r.state.players[0].pos, x: r.state.players[0].pos.x + 1 };
		r.leave(1);
		r.move(0, "right", 1000);
		expect(r.state.players[0].moves).toBe(1);
	});

	test("does nothing after the end", () => {
		const r = running();
		r.leave(0);
		r.leave(1);
		expect(r.state.players[1].status).toBe("playing");
		expect(r.state.winnerSlot).toBe(1);
	});
});

describe("setConnected", () => {
	test("a disconnected player stops, and plays again on reconnect", () => {
		const r = running();
		r.setConnected(0, false, 1000);
		expect(r.state.players[0].status).toBe("disconnected");
		expect(r.state.players[0].disconnectedAt).toBe(1000);
		r.move(0, "right", 1000);
		expect(r.state.players[0].moves).toBe(0);
		r.setConnected(0, true, 2000);
		expect(r.state.players[0].status).toBe("playing");
		expect(r.state.players[0].disconnectedAt).toBeNull();
		r.move(0, "right", 2000);
		expect(r.state.players[0].moves).toBe(1);
	});

	test("a disconnected player still blocks, but sharks do not kill them", () => {
		const r = running(1000, always("left"));
		r.state.monsters = [{ x: 2, y: 1 }];
		r.setConnected(0, false, 1000);
		r.tickMonsters(1500);
		expect(r.state.players[0].status).toBe("disconnected");
		r.state.monsters = [];
		r.state.players[1].pos = { x: 2, y: 1 };
		r.move(1, "left", 2000);
		expect(r.state.players[1].pos).toEqual({ x: 2, y: 1 });
	});

	test("a dead player who disconnects only respawns after coming back", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.move(0, "right", 1000);
		r.state.monsters = [];
		r.setConnected(0, false, 1500);
		expect(r.state.players[0].status).toBe("dead");
		r.tickSecond(5000);
		expect(r.state.players[0].status).toBe("dead");
		r.setConnected(0, true, 5500);
		r.tickSecond(6000);
		expect(r.state.players[0].status).toBe("playing");
	});

	test("away for 30 s -> loses", () => {
		const r = running();
		r.setConnected(0, false, 2000);
		r.tickSecond(2000 + RECONNECT_TIMEOUT_MS - 1);
		expect(r.state.status).toBe("running");
		r.tickSecond(2000 + RECONNECT_TIMEOUT_MS);
		expect(r.state.players[0].status).toBe("left");
		expect(r.state.winnerSlot).toBe(1);
		expect(r.state.endReason).toBe("forfeit");
	});

	test("coming back in time cancels it", () => {
		const r = running();
		r.setConnected(0, false, 2000);
		r.setConnected(0, true, 20_000);
		r.tickSecond(2000 + RECONNECT_TIMEOUT_MS);
		expect(r.state.status).toBe("running");
	});
});

describe("events", () => {
	test("diamond, power-up picked and used, death, in order; takeEvents empties the list", () => {
		const r = running();
		r.state.diamonds = [{ x: 2, y: 1 }];
		r.state.powerUps = [{ type: "speed", pos: { x: 3, y: 1 } }];
		r.state.monsters = [{ x: 4, y: 1 }];
		r.move(0, "right", 1000);
		r.move(0, "right", 1200);
		r.usePowerUp(0, 1300);
		r.move(0, "right", 1400);
		expect(r.takeEvents()).toEqual([
			{ type: "diamond", slot: 0, pos: { x: 2, y: 1 } },
			{ type: "powerUpPickup", slot: 0, powerUp: "speed" },
			{ type: "powerUpUsed", slot: 0, powerUp: "speed" },
			{ type: "death", slot: 0, pos: { x: 4, y: 1 } },
		]);
		expect(r.takeEvents()).toEqual([]);
	});
});

describe("snapshot", () => {
	test("in countdown the clock shows the whole time", () => {
		expect(room().snapshot(0).timeLeftMs).toBe(SIZE_RULES.small.timeLimitMs);
	});

	test("times are sent as ms left, and there are no walls", () => {
		const r = running();
		const p = r.state.players[0];
		p.frozenUntil = 2500;
		p.speedUntil = 900;
		r.state.monstersFrozenUntil = 3000;
		const snap = r.snapshot(2000);
		expect(snap.timeLeftMs).toBe(SIZE_RULES.small.timeLimitMs - 1000);
		expect(snap.players[0].frozenMs).toBe(500);
		expect(snap.players[0].speedMs).toBe(0);
		expect(snap.monstersFrozenMs).toBe(1000);
		expect(snap).not.toHaveProperty("walls");
		expect(snap.players[0]).not.toHaveProperty("userId");
	});

	test("respawnMs only while dead", () => {
		const r = running();
		r.state.monsters = [{ x: 2, y: 1 }];
		r.move(0, "right", 1000);
		expect(r.snapshot(2000).players[0].respawnMs).toBe(2000);
		expect(r.snapshot(2000).players[1].respawnMs).toBe(0);
	});

	test("the lists are copies", () => {
		const r = running();
		r.state.diamonds = [{ x: 2, y: 1 }];
		const snap = r.snapshot(1000);
		r.move(0, "right", 1000);
		expect(snap.diamonds).toHaveLength(1);
	});
});
