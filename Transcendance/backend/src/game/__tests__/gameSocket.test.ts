import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Socket } from "socket.io";
import { BROADCAST_INTERVAL_MS, COUNTDOWN_SECONDS, RECONNECT_TIMEOUT_MS } from "../config";
import { GameManager, type MatchPlayer, type Transport } from "../GameManager";
import { readDirection, registerGameEvents } from "../gameSocket";
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
	const socket = {
		id,
		data: { userId },
		on: (event: string, handler: (data?: unknown) => void) => handlers.set(event, handler),
	};
	const send = (event: string, data?: unknown) => handlers.get(event)?.(data);
	return { socket: socket as unknown as Socket, send };
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
