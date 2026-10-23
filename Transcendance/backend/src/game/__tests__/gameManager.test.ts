import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BROADCAST_INTERVAL_MS, COUNTDOWN_SECONDS, MONSTER_INTERVAL_MS, SIZE_RULES } from "../config";
import { GameManager, type MatchPlayer, type Transport } from "../GameManager";
import { mapsFor } from "../mapLoader";
import type { DynamicState, GameEvent, GameStart } from "../types";
import { seeded } from "./helpers";

type Sent = { to: string; event: string; data: unknown };

// Writes down everything the manager sends, instead of sending it
function fakeTransport() {
	const sent: Sent[] = [];
	const channels = new Map<string, string>(); // socketId -> channel it is in
	const transport: Transport = {
		join: (socketId, channel) => channels.set(socketId, channel),
		leave: (socketId) => channels.delete(socketId),
		toChannel: (channel, event, data) => sent.push({ to: channel, event, data }),
		toSocket: (socketId, event, data) => sent.push({ to: socketId, event, data }),
	};
	const events = (event: string) => sent.filter((s) => s.event === event);
	return { transport, sent, channels, events };
}

const PLAYERS: MatchPlayer[] = [
	{ userId: 1, username: "ana", character: "goldfish", socketId: "s1" },
	{ userId: 2, username: "bia", character: "betta", socketId: "s2" },
];

const OTHERS: MatchPlayer[] = [
	{ userId: 3, username: "cris", character: "angler", socketId: "s3" },
	{ userId: 4, username: "duda", character: "puffer", socketId: "s4" },
];

function last<T>(list: T[]): T {
	return list[list.length - 1];
}

// Countdown over and the "running" state already sent
const STARTED_MS = COUNTDOWN_SECONDS * 1000 + BROADCAST_INTERVAL_MS;

function setup(map = "small-1") {
	const fake = fakeTransport();
	const manager = new GameManager(fake.transport, seeded(1));
	const onEnd = vi.fn();
	const id = manager.createGame({ players: PLAYERS, map, onEnd });
	return { ...fake, manager, onEnd, id };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createGame", () => {
	test("sends game:start to each player with their own slot and puts them in the channel", () => {
		const { events, channels, id } = setup();
		const starts = events("game:start");
		expect(starts.map((s) => s.to)).toEqual(["s1", "s2"]);
		expect(starts.map((s) => (s.data as GameStart).you)).toEqual([0, 1]);
		const first = starts[0].data as GameStart;
		expect(first.gameId).toBe(id);
		expect(first.map.name).toBe("small-1");
		expect(first.state.status).toBe("countdown");
		expect(channels.get("s1")).toBe(`game:${id}`);
		expect(channels.get("s2")).toBe(`game:${id}`);
	});

	test("counts 3, 2, 1 and then the match is running", () => {
		const { events, manager } = setup();
		vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000 - 1);
		expect(events("game:countdown").map((s) => s.data)).toEqual([3, 2, 1]);
		expect(manager.find(1)?.room.state.status).toBe("countdown");
		vi.advanceTimersByTime(1 + BROADCAST_INTERVAL_MS);
		expect(manager.find(1)?.room.state.status).toBe("running");
		const states = events("game:state").map((s) => s.data as DynamicState);
		expect(last(states).status).toBe("running");
	});

	test("random map: one of the maps for that number of players", () => {
		const { events } = setup("random");
		const map = (events("game:start")[0].data as GameStart).map.name;
		expect(mapsFor(2)).toContain(map);
	});

	test("refuses a player who is already in a match", () => {
		const { manager } = setup();
		expect(() => manager.createGame({ players: PLAYERS, map: "small-1" })).toThrow("already in a match");
	});

	test("refuses a map that is not for that number of players", () => {
		const { manager } = setup();
		const three = [...OTHERS, { userId: 5, username: "eva", character: "goldfish" as const, socketId: "s5" }];
		expect(() => manager.createGame({ players: three, map: "small-1" })).toThrow();
	});
});

describe("find", () => {
	test("the match and the slot of each player", () => {
		const { manager } = setup();
		expect(manager.find(1)?.slot).toBe(0);
		expect(manager.find(2)?.slot).toBe(1);
		expect(manager.find(1)?.room).toBe(manager.find(2)?.room);
	});

	test("null for someone who is not playing", () => {
		const { manager } = setup();
		expect(manager.find(99)).toBeNull();
	});
});

describe("broadcast", () => {
	test("nothing changed: no game:state", () => {
		const { events } = setup();
		vi.advanceTimersByTime(STARTED_MS);
		const before = events("game:state").length;
		// less than the time until the next shark step
		vi.advanceTimersByTime(MONSTER_INTERVAL_MS - 2 * BROADCAST_INTERVAL_MS);
		expect(events("game:state").length).toBe(before);
	});

	test("a move is sent in the next broadcast, with its events", () => {
		const { events, manager } = setup();
		vi.advanceTimersByTime(STARTED_MS);
		const { room } = manager.find(1)!;
		room.state.diamonds = [{ x: 2, y: 1 }]; // right next to the spawn of player 0 (1,1)
		room.move(0, "right", Date.now());
		vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
		const state = last(events("game:state")).data as DynamicState;
		expect(state.players[0].pos).toEqual({ x: 2, y: 1 });
		expect(state.players[0].diamonds).toBe(1);
		const sentEvents = last(events("game:event")).data as GameEvent[];
		expect(sentEvents).toEqual([{ type: "diamond", slot: 0, pos: { x: 2, y: 1 } }]);
	});
});

describe("end of the match", () => {
	test("a player leaves: game:end with the winner, and the match is forgotten", () => {
		const { events, manager, onEnd, channels } = setup();
		vi.advanceTimersByTime(STARTED_MS);
		manager.find(1)!.room.leave(0);
		vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
		const end = events("game:end")[0].data as DynamicState;
		expect(end.winnerSlot).toBe(1);
		expect(end.endReason).toBe("forfeit");
		expect(onEnd).toHaveBeenCalledWith(end);
		expect(manager.count).toBe(0);
		expect(manager.find(1)).toBeNull();
		expect(channels.size).toBe(0);
	});

	test("the time is over: game:end by timeout", () => {
		const { events } = setup();
		vi.advanceTimersByTime(STARTED_MS + SIZE_RULES.small.timeLimitMs + 1000);
		const end = events("game:end")[0].data as DynamicState;
		expect(end.status).toBe("finished");
		expect(end.endReason).toBe("timeout");
	});

	test("after the end, nothing else is sent (the timers stopped)", () => {
		const { sent, manager } = setup();
		vi.advanceTimersByTime(STARTED_MS);
		manager.find(1)!.room.leave(0);
		vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
		const total = sent.length;
		vi.advanceTimersByTime(10_000);
		expect(sent.length).toBe(total);
	});

	test("the same players can start a new match", () => {
		const { manager } = setup();
		vi.advanceTimersByTime(STARTED_MS);
		manager.find(1)!.room.leave(0);
		vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
		expect(() => manager.createGame({ players: PLAYERS, map: "small-1" })).not.toThrow();
	});
});

describe("two matches at the same time", () => {
	test("each one has its own channel and players", () => {
		const { manager, events, channels, id } = setup();
		const other = manager.createGame({ players: OTHERS, map: "small-2" });
		expect(manager.count).toBe(2);
		expect(other).not.toBe(id);
		expect(channels.get("s3")).toBe(`game:${other}`);
		expect(manager.find(3)?.room).not.toBe(manager.find(1)?.room);
		expect(events("game:start").filter((s) => s.to === "s3" || s.to === "s4")).toHaveLength(2);
	});

	test("the end of one does not touch the other", () => {
		const { manager, events } = setup();
		const other = manager.createGame({ players: OTHERS, map: "small-2" });
		vi.advanceTimersByTime(STARTED_MS);
		manager.find(1)!.room.leave(0);
		vi.advanceTimersByTime(BROADCAST_INTERVAL_MS);
		expect(events("game:end").map((s) => s.to)).not.toContain(`game:${other}`);
		expect(manager.count).toBe(1);
		expect(manager.find(3)?.room.state.status).toBe("running");
	});
});
