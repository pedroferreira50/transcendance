import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Server } from "socket.io";
import type { GameManager, MatchSetup } from "../game/GameManager";
import { mapsFor } from "../game/mapLoader";
import type { DynamicState } from "../game/types";
import { readCharacter, readSettings, setupLobby } from "../lobby";

// The database is not opened in the tests: only the UPDATEs are written down
const db = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../database", () => ({ default: { prepare: () => ({ run: db.run }) } }));

type Received = { event: string; data: unknown };

type FakeSocket = {
	id: string;
	data: { userId: number; username: string };
	rooms: Set<string>;
	received: Received[];
	send: (event: string, data?: unknown) => void;
};

// A Socket.IO server that keeps everything in memory: io.to(room).emit
// delivers to the fake sockets in that room (or with that id)
function fakeServer() {
	let onConnection: (socket: unknown) => void = () => {};
	const sockets = new Map<string, FakeSocket>();
	const io = {
		on: (_event: string, handler: (socket: unknown) => void) => {
			onConnection = handler;
		},
		to: (room: string) => ({
			emit: (event: string, data?: unknown) => {
				for (const socket of sockets.values())
					if (socket.id === room || socket.rooms.has(room))
						socket.received.push({ event, data });
			},
		}),
		sockets: { sockets },
	};

	const connect = (id: string, userId: number, username: string): FakeSocket => {
		const handlers = new Map<string, (data?: unknown) => void>();
		const rooms = new Set<string>();
		const received: Received[] = [];
		const socket = {
			id,
			data: { userId, username },
			rooms,
			received,
			on: (event: string, handler: (data?: unknown) => void) => handlers.set(event, handler),
			emit: (event: string, data?: unknown) => received.push({ event, data }),
			join: (room: string) => rooms.add(room),
			leave: (room: string) => rooms.delete(room),
			send: (event: string, data?: unknown) => handlers.get(event)?.(data),
		};
		sockets.set(id, socket);
		onConnection(socket);
		return socket;
	};

	return { io: io as unknown as Server, sockets, connect };
}

// The last time this socket received that event
function lastOf(socket: FakeSocket, event: string): any {
	const all = socket.received.filter((r) => r.event === event);
	return all.length > 0 ? all[all.length - 1].data : undefined;
}

let server: ReturnType<typeof fakeServer>;
let createGame: ReturnType<typeof vi.fn>;

beforeEach(() => {
	server = fakeServer();
	createGame = vi.fn(() => "game-1");
	setupLobby(server.io, { createGame } as unknown as GameManager);
	db.run.mockClear();
});

// the lobbies live in lobby.ts between tests: everyone leaves at the end of each one
afterEach(() => {
	for (const socket of server.sockets.values())
		socket.send("disconnect");
});

// ana creates a lobby, bia joins; both choose a fish and ready up
function fullLobby() {
	const ana = server.connect("s1", 1, "ana");
	const bia = server.connect("s2", 2, "bia");
	ana.send("lobby:create");
	const code = lastOf(ana, "lobby:joined").code;
	bia.send("lobby:join", { code });
	ana.send("lobby:character", "goldfish");
	bia.send("lobby:character", "betta");
	ana.send("lobby:ready");
	bia.send("lobby:ready");
	return { ana, bia, code };
}

describe("readSettings", () => {
	test("accepts 2, 3 or 4 seats with random or a map for that number", () => {
		expect(readSettings({ seats: 2, map: "random" })).toEqual({ seats: 2, map: "random" });
		expect(readSettings({ seats: 3, map: mapsFor(3)[0] })).toEqual({ seats: 3, map: mapsFor(3)[0] });
	});

	test("refuses anything else", () => {
		const onlyFor2 = mapsFor(2).find((map) => !mapsFor(3).includes(map));
		for (const data of [null, "random", {}, { seats: 5, map: "random" }, { seats: "2", map: "random" }, { seats: 2 }, { seats: 2, map: "nowhere" }, { seats: 3, map: onlyFor2 }])
			expect(readSettings(data)).toBeNull();
	});
});

describe("readCharacter", () => {
	test("only the 4 fish", () => {
		expect(readCharacter("puffer")).toBe("puffer");
		for (const data of [null, "shark", "Puffer", { character: "puffer" }])
			expect(readCharacter(data)).toBeNull();
	});
});

describe("lobby", () => {
	test("a new lobby: 2 seats, random map, no fish chosen", () => {
		const ana = server.connect("s1", 1, "ana");
		ana.send("lobby:create");
		const lobby = lastOf(ana, "lobby:joined");
		expect(lobby.seats).toBe(2);
		expect(lobby.map).toBe("random");
		expect(lobby.players).toEqual([{ id: "s1", username: "ana", character: null, ready: false }]);
	});

	test("full when every seat is taken", () => {
		const { code } = fullLobby();
		const cris = server.connect("s3", 3, "cris");
		cris.send("lobby:join", { code });
		expect(lastOf(cris, "lobby:error")).toBe("Lobby is full.");
	});

	test("settings: only the host, and everyone has to ready up again", () => {
		const { ana, bia } = fullLobby();
		bia.send("lobby:settings", { seats: 3, map: "random" });
		expect(lastOf(ana, "lobby:update").seats).toBe(2);
		ana.send("lobby:settings", { seats: 3, map: "random" });
		const lobby = lastOf(bia, "lobby:update");
		expect(lobby.seats).toBe(3);
		expect(lobby.players.map((p: { ready: boolean }) => p.ready)).toEqual([false, false]);
	});

	test("settings: never fewer seats than players inside", () => {
		const { ana, code } = fullLobby();
		ana.send("lobby:settings", { seats: 3, map: "random" });
		server.connect("s3", 3, "cris").send("lobby:join", { code });
		ana.send("lobby:settings", { seats: 2, map: "random" });
		expect(lastOf(ana, "lobby:update").seats).toBe(3);
		expect(lastOf(ana, "lobby:error")).toBeDefined();
	});

	test("character: two players can not have the same fish", () => {
		const { bia } = fullLobby();
		bia.send("lobby:character", "goldfish");
		expect(lastOf(bia, "lobby:error")).toBe("That fish was already chosen.");
		expect(lastOf(bia, "lobby:update").players[1].character).toBe("betta");
	});

	test("ready only after choosing a fish", () => {
		const ana = server.connect("s1", 1, "ana");
		ana.send("lobby:create");
		ana.send("lobby:ready");
		expect(lastOf(ana, "lobby:error")).toBe("Choose a fish first.");
	});
});

describe("start", () => {
	test("does not start with an empty seat", () => {
		const { ana } = fullLobby();
		ana.send("lobby:settings", { seats: 3, map: "random" });
		ana.send("lobby:start");
		expect(createGame).not.toHaveBeenCalled();
	});

	test("only the host starts", () => {
		const { bia } = fullLobby();
		bia.send("lobby:start");
		expect(createGame).not.toHaveBeenCalled();
	});

	test("hands the players (slot = order in the lobby) and the map to the GameManager", () => {
		const { ana } = fullLobby();
		ana.send("lobby:start");
		const setup: MatchSetup = createGame.mock.calls[0][0];
		expect(setup.map).toBe("random");
		expect(setup.players).toEqual([
			{ userId: 1, username: "ana", character: "goldfish", socketId: "s1" },
			{ userId: 2, username: "bia", character: "betta", socketId: "s2" },
		]);
	});

	test("in a match: nobody joins, and settings and fish are locked", () => {
		const { ana, code } = fullLobby();
		ana.send("lobby:start");
		const cris = server.connect("s3", 3, "cris");
		cris.send("lobby:join", { code });
		expect(lastOf(cris, "lobby:error")).toBe("Match already in progress.");
		const updates = ana.received.length;
		ana.send("lobby:settings", { seats: 3, map: "random" });
		ana.send("lobby:character", "puffer");
		expect(ana.received.length).toBe(updates);
	});

	test("the GameManager refuses: lobby:error for everyone in the lobby", () => {
		const { ana, bia } = fullLobby();
		createGame.mockImplementation(() => {
			throw new Error("ana is already in a match");
		});
		ana.send("lobby:start");
		expect(lastOf(bia, "lobby:error")).toBe("ana is already in a match");
	});
});

describe("end of the match (onEnd)", () => {
	function endWith(winnerSlot: number | null) {
		const { ana, bia, code } = fullLobby();
		ana.send("lobby:start");
		const setup: MatchSetup = createGame.mock.calls[0][0];
		setup.onEnd!({ winnerSlot } as DynamicState);
		return { ana, bia, code };
	}

	test("records the win and the loss", () => {
		endWith(1);
		expect(db.run.mock.calls).toEqual([["bia"], ["ana"]]);
	});

	test("a draw records nothing", () => {
		endWith(null);
		expect(db.run).not.toHaveBeenCalled();
	});

	test("the lobby is open again and everyone has to ready up", () => {
		const { ana } = endWith(1);
		const lobby = lastOf(ana, "lobby:update");
		expect(lobby.players.map((p: { ready: boolean }) => p.ready)).toEqual([false, false]);
		ana.send("lobby:ready");
		expect(lastOf(ana, "lobby:update").players[0].ready).toBe(true);
	});
});
