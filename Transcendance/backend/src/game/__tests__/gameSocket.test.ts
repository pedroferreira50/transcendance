import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Socket } from "socket.io";
import { BROADCAST_INTERVAL_MS, COUNTDOWN_SECONDS, RECONNECT_TIMEOUT_MS } from "../config";
import { GameManager, type MatchPlayer, type Transport } from "../GameManager";
import { readDirection, readLocalSetup, readSlot, registerGameEvents } from "../gameSocket";
import { seeded } from "./helpers";

const transport: Transport = { join: () => {}, leave: () => {}, toChannel: () => {}, toSocket: () => {} };

const PLAYERS: MatchPlayer[] = [
	{ userId: 1, username: "ana", character: "goldfish", socketId: "s1" },
	{ userId: 2, username: "bia", character: "betta", socketId: "s2" },
];

const STARTED_MS = COUNTDOWN_SECONDS * 1000 + BROADCAST_INTERVAL_MS;

// A socket that only keeps the handlers, so the test can "send" an event by calling them
function fakeSocket(id: string, userId?: number) {
	const handlers = new Map<string, (data?: unknown) => void>();
	const emitted: { event: string; data: unknown }[] = []; // what the server sent back to this socket
	const socket = {
		id,
		data: { userId },
		on: (event: string, handler: (data?: unknown) => void) => handlers.set(event, handler),
		emit: (event: string, data: unknown) => emitted.push({ event, data }),
	};
	const send = (event: string, data?: unknown) => handlers.get(event)?.(data);
	return { socket: socket as unknown as Socket, send, emitted };
}

function setup() {
	const games = new GameManager(transport, seeded(1));
	games.createGame({ players: PLAYERS, map: "small-1" });
	vi.advanceTimersByTime(STARTED_MS);
	const ana = fakeSocket("s1", 1);
	registerGameEvents(ana.socket, games);
	const room = games.find(1)!.room;
	return { games, ana, room };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("readDirection", () => {
	test("accepts the 4 directions", () => {
		for (const dir of ["up", "down", "left", "right"])
			expect(readDirection({ dir })).toBe(dir);
	});

	test("refuses anything else", () => {
		for (const data of [undefined, null, "up", 3, {}, { dir: "UP" }, { dir: "jump" }, { dir: 1 }, ["up"]])
			expect(readDirection(data)).toBeNull();
	});
});

describe("game events", () => {
	test("game:move moves the fish of the user of the socket", () => {
		const { ana, room } = setup();
		ana.send("game:move", { dir: "right" });
		expect(room.state.players[0].pos).toEqual({ x: 2, y: 1 });
		expect(room.state.players[1].pos).not.toEqual({ x: 2, y: 1 });
	});

	test("game:move with invalid data does nothing", () => {
		const { ana, room } = setup();
		const before = { ...room.state.players[0].pos };
		ana.send("game:move", { dir: "jump" });
		ana.send("game:move", "right");
		expect(room.state.players[0].pos).toEqual(before);
	});

	test("a socket without login or without a match is ignored", () => {
		const { games, room } = setup();
		const before = { ...room.state.players[0].pos };
		const guest = fakeSocket("s9");
		const outsider = fakeSocket("s8", 99);
		registerGameEvents(guest.socket, games);
		registerGameEvents(outsider.socket, games);
		guest.send("game:move", { dir: "right" });
		outsider.send("game:leave");
		expect(room.state.players[0].pos).toEqual(before);
		expect(room.state.status).toBe("running");
	});

	test("game:usePowerUp uses the power-up of the user", () => {
		const { ana, room } = setup();
		room.state.players[0].powerUp = "speed";
		ana.send("game:usePowerUp");
		expect(room.state.players[0].powerUp).toBeNull();
	});

	test("game:leave gives up: the other one wins by forfeit", () => {
		const { ana, room } = setup();
		ana.send("game:leave");
		expect(room.state.status).toBe("finished");
		expect(room.state.winnerSlot).toBe(1);
		expect(room.state.endReason).toBe("forfeit");
	});
});

describe("disconnect", () => {
	test("the fish waits, and leaves after RECONNECT_TIMEOUT_MS", () => {
		const { ana, room } = setup();
		ana.send("disconnect");
		expect(room.state.players[0].status).toBe("disconnected");
		expect(room.state.status).toBe("running");
		vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS + 1000);
		expect(room.state.status).toBe("finished");
		expect(room.state.winnerSlot).toBe(1);
	});

	test("another tab of the same user closing does not touch the match", () => {
		const { games, room } = setup();
		const otherTab = fakeSocket("s7", 1);
		registerGameEvents(otherTab.socket, games);
		otherTab.send("disconnect");
		expect(room.state.players[0].status).toBe("playing");
	});
});

describe("readSlot and readLocalSetup", () => {
	test("a slot is only 0 or 1", () => {
		expect(readSlot({ slot: 0 })).toBe(0);
		expect(readSlot({ slot: 1 })).toBe(1);
		for (const data of [undefined, null, {}, { slot: 2 }, { slot: -1 }, { slot: "1" }, { slot: 0.5 }])
			expect(readSlot(data)).toBeNull();
	});

	test("accepts a map for 2 players (or random) and two different fish", () => {
		expect(readLocalSetup({ map: "small-1", characters: ["goldfish", "betta"] }))
			.toEqual({ map: "small-1", characters: ["goldfish", "betta"] });
		expect(readLocalSetup({ map: "random", characters: ["angler", "puffer"] })).not.toBeNull();
	});

	test("refuses anything else", () => {
		const wrong = [
			undefined,
			{ map: "small-1" },
			{ map: "nowhere", characters: ["goldfish", "betta"] },
			{ map: "small-1", characters: ["goldfish", "goldfish"] },
			{ map: "small-1", characters: ["goldfish", "shark"] },
			{ map: "small-1", characters: ["goldfish"] },
			{ map: 1, characters: ["goldfish", "betta"] },
		];
		for (const data of wrong)
			expect(readLocalSetup(data)).toBeNull();
	});
});

describe("local match", () => {
	function setupLocal() {
		const starts: unknown[] = [];
		const games = new GameManager({ ...transport, toSocket: (_id, event, data) => {
			if (event === "game:start")
				starts.push(data);
		} }, seeded(1));
		const ana = fakeSocket("s1", 1);
		registerGameEvents(ana.socket, games);
		ana.send("local:start", { map: "small-1", characters: ["goldfish", "betta"] });
		vi.advanceTimersByTime(STARTED_MS);
		return { games, ana, starts, room: games.find(1)!.room };
	}

	test("local:start sends one game:start, with you = null and both fish as guests", () => {
		const { starts, room } = setupLocal();
		expect(starts).toHaveLength(1);
		expect(starts[0]).toMatchObject({ you: null });
		expect(room.state.local).toBe(true);
		expect(room.state.players.map((p) => p.username)).toEqual(["Player 1", "Player 2"]);
		expect(room.state.players.map((p) => p.userId)).toEqual([null, null]);
	});

	test("each command moves the fish of its slot; without a slot nothing moves", () => {
		const { ana, room } = setupLocal();
		const second = { ...room.state.players[1].pos };
		ana.send("game:move", { dir: "right", slot: 0 });
		expect(room.state.players[0].pos).toEqual({ x: 2, y: 1 });
		expect(room.state.players[1].pos).toEqual(second);
		const first = { ...room.state.players[0].pos };
		ana.send("game:move", { dir: "left" });
		ana.send("game:move", { dir: "left", slot: 2 });
		expect(room.state.players[0].pos).toEqual(first);
	});

	test("game:leave and the disconnect end the match", () => {
		const left = setupLocal();
		left.ana.send("game:leave");
		expect(left.room.state.status).toBe("finished");
		const gone = setupLocal();
		gone.ana.send("disconnect");
		expect(gone.room.state.status).toBe("finished");
	});

	test("refuses bad data and a user already in a match", () => {
		const { ana } = setupLocal();
		ana.send("local:start", { map: "small-1", characters: ["goldfish", "betta"] });
		ana.send("local:start", { map: "small-1", characters: ["goldfish", "goldfish"] });
		expect(ana.emitted.map((e) => e.event)).toEqual(["local:error", "local:error"]);
		const guest = fakeSocket("s9");
		registerGameEvents(guest.socket, new GameManager(transport, seeded(1)));
		guest.send("local:start", { map: "small-1", characters: ["goldfish", "betta"] });
		expect(guest.emitted.map((e) => e.event)).toEqual(["local:error"]);
	});
});
