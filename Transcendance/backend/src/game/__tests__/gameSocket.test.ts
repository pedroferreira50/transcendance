import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Socket } from "socket.io";
import { BROADCAST_INTERVAL_MS, COUNTDOWN_SECONDS, RECONNECT_TIMEOUT_MS } from "../config";
import { GameManager, type MatchPlayer, type Transport } from "../GameManager";
import { readDirection, readLocalSetup, readSlot, registerGameEvents } from "../gameSocket";
import type { GameStart } from "../types";
import { seeded } from "./helpers";

const transport: Transport = { join: () => {}, leave: () => {}, toChannel: () => {}, toSocket: () => {} };

const PLAYERS: MatchPlayer[] = [
	{ userId: 1, username: "ana", character: "goldfish", socketId: "s1" },
	{ userId: 2, username: "bia", character: "betta", socketId: "s2" },
];

// a new copy for each match: rejoin() changes the socketId of the players it gets
const players = () => PLAYERS.map((p) => ({ ...p }));

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
	games.createGame({ players: players(), map: "small-1" });
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

	test("after another tab takes the match, the old one closing does not touch it", () => {
		const { games, ana, room } = setup();
		const otherTab = fakeSocket("s7", 1);
		registerGameEvents(otherTab.socket, games);
		ana.send("disconnect");
		expect(room.state.players[0].status).toBe("playing");
	});
});

describe("rejoin", () => {
	// the transport writes down the game:resume, the game:gone and who is in each channel
	function setupRejoin(local = false, count = 2) {
		const resumes: { to: string; data: GameStart }[] = [];
		const gone: string[] = []; // the sockets that got game:gone
		const channels = new Map<string, string>(); // socketId -> channel
		const games = new GameManager({
			join: (socketId, channel) => channels.set(socketId, channel),
			leave: (socketId) => channels.delete(socketId),
			toChannel: () => {},
			toSocket: (to, event, data) => {
				if (event === "game:resume")
					resumes.push({ to, data: data as GameStart });
				if (event === "game:gone")
					gone.push(to);
			},
		}, seeded(1));
		const ana = fakeSocket("s1", 1);
		registerGameEvents(ana.socket, games);
		if (local)
			ana.send("local:start", { map: "small-1", characters: ["goldfish", "betta"] });
		else if (count === 3)
			games.createGame({ players: [...players(), { userId: 4, username: "duda", character: "angler", socketId: "s4" }], map: "random" });
		else
			games.createGame({ players: players(), map: "small-1" });
		vi.advanceTimersByTime(STARTED_MS);
		gone.length = 0; // ana connected before the match: that game:gone does not count
		return { games, ana, resumes, gone, channels, room: games.find(1)!.room };
	}

	test("a new socket of the same user gets game:resume and plays again", () => {
		const { games, ana, resumes, channels, room } = setupRejoin();
		ana.send("disconnect");
		expect(room.state.players[0].status).toBe("disconnected");
		const back = fakeSocket("s5", 1);
		registerGameEvents(back.socket, games);
		expect(room.state.players[0].status).toBe("playing");
		expect(resumes).toHaveLength(1);
		expect(resumes[0].to).toBe("s5");
		expect(resumes[0].data).toMatchObject({ you: 0, local: false, countdown: 0 });
		expect(resumes[0].data.map.name).toBe(room.state.mapName);
		expect(resumes[0].data.state.status).toBe("running");
		expect(channels.get("s5")).toBe(channels.get("s2")); // in the channel of the match
		expect(channels.has("s1")).toBe(false);
		back.send("game:move", { dir: "right" });
		expect(room.state.players[0].moves).toBe(1);
	});

	test("coming back before RECONNECT_TIMEOUT_MS keeps the match going", () => {
		const { games, ana, room } = setupRejoin();
		ana.send("disconnect");
		vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS - 5000);
		registerGameEvents(fakeSocket("s5", 1).socket, games);
		vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS);
		expect(room.state.status).toBe("running");
	});

	test("local: both fish come back, and the screen knows it is local", () => {
		const { games, ana, resumes, room } = setupRejoin(true);
		ana.send("disconnect");
		const back = fakeSocket("s5", 1);
		registerGameEvents(back.socket, games);
		expect(room.state.players.map((p) => p.status)).toEqual(["playing", "playing"]);
		expect(resumes[0].data).toMatchObject({ you: null, local: true });
		back.send("game:move", { dir: "left", slot: 1 }); // Player 2 starts on the right side
		expect(room.state.players[1].moves).toBe(1);
	});

	test("game:gone for a user who is not in a match, and nothing for a socket without login", () => {
		const { games, resumes, gone } = setupRejoin();
		registerGameEvents(fakeSocket("s8", 3).socket, games);
		registerGameEvents(fakeSocket("s9").socket, games);
		expect(resumes).toHaveLength(0);
		expect(gone).toEqual(["s8"]);
	});

	test("game:gone when the match ended while the user was away", () => {
		const { games, ana, resumes, gone } = setupRejoin();
		ana.send("disconnect");
		vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS + 2000); // only one was left: the match is over
		expect(games.count).toBe(0);
		registerGameEvents(fakeSocket("s5", 1).socket, games);
		expect(resumes).toHaveLength(0);
		expect(gone).toEqual(["s5"]);
	});

	test("game:gone for who left a match that goes on without them", () => {
		const { games, ana, resumes, gone, room } = setupRejoin(false, 3);
		ana.send("game:leave");
		registerGameEvents(fakeSocket("s5", 1).socket, games);
		expect(room.state.status).toBe("running");
		expect(room.state.players[0].status).toBe("left");
		expect(resumes).toHaveLength(0);
		expect(gone).toEqual(["s5"]);
	});
});

describe("spectator", () => {
	// Starts a match of ana and bia that cris watches.
	function setupWatched() {
		const channels = new Map<string, string>();
		const games = new GameManager({
			...transport,
			join: (socketId, channel) => channels.set(socketId, channel),
			leave: (socketId) => channels.delete(socketId),
		}, seeded(1));
		const id = games.createGame({ players: players(), map: "small-1" });
		vi.advanceTimersByTime(STARTED_MS);
		const cris = fakeSocket("w1", 3);
		registerGameEvents(cris.socket, games);
		games.spectate(id, "w1", 3);
		return { games, cris, channels, room: games.find(1)!.room };
	}

	test("can not move or use a power-up: no fish is theirs", () => {
		const { cris, room } = setupWatched();
		room.state.players[0].powerUp = "speed";
		const before = room.state.players.map((p) => ({ ...p.pos }));
		cris.send("game:move", { dir: "right" });
		cris.send("game:usePowerUp");
		cris.send("game:leave");
		expect(room.state.players.map((p) => p.pos)).toEqual(before);
		expect(room.state.players[0].powerUp).toBe("speed");
		expect(room.state.status).toBe("running");
	});

	test("game:unspectate leaves the channel, and the match goes on", () => {
		const { cris, channels, room } = setupWatched();
		expect(channels.has("w1")).toBe(true);
		cris.send("game:unspectate");
		expect(channels.has("w1")).toBe(false);
		expect(room.state.status).toBe("running");
	});

	test("a spectator who disconnects leaves the channel, and no fish is touched", () => {
		const { cris, channels, room } = setupWatched();
		cris.send("disconnect");
		expect(channels.has("w1")).toBe(false);
		expect(room.state.players.map((p) => p.status)).toEqual(["playing", "playing"]);
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

	test("game:leave ends the match as if the time was over: the most diamonds wins", () => {
		const { ana, room } = setupLocal();
		room.state.players[0].diamonds = 1;
		ana.send("game:leave");
		expect(room.state.status).toBe("finished");
		expect(room.state.endReason).toBe("timeout");
		expect(room.state.winnerSlot).toBe(0);
	});

	test("the disconnect waits RECONNECT_TIMEOUT_MS for both fish, then the match ends", () => {
		const { games, ana, room } = setupLocal();
		ana.send("disconnect");
		expect(room.state.status).toBe("running");
		expect(room.state.players.map((p) => p.status)).toEqual(["disconnected", "disconnected"]);
		vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS + 1000);
		expect(room.state.status).toBe("finished");
		expect(games.count).toBe(0);
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
