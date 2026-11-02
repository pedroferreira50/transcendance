import { expect, test, vi } from "vitest";
import type { Server } from "socket.io";
import { setupOneConnectionPerUser } from "../socketAuth";

// only setupOneConnectionPerUser is tested here: no database and no tokens
vi.mock("../database", () => ({ default: {} }));
vi.mock("../auth", () => ({ tokenFromCookieHeader: () => null, verifyToken: () => null }));

type FakeSocket = {
	userId: number;
	received: string[];
	closed: boolean;
	close: () => void;
};

// A server where connect() runs the connection handler, and disconnect()
// on a socket runs its "disconnect" handler, as Socket.IO does
function fakeServer() {
	let onConnection: (socket: unknown) => void = () => {};
	const io = {
		on: (_event: string, handler: (socket: unknown) => void) => {
			onConnection = handler;
		},
	};

	const connect = (userId: number): FakeSocket => {
		let onDisconnect = () => {};
		const fake: FakeSocket = {
			userId,
			received: [],
			closed: false,
			close: () => {
				fake.closed = true;
				onDisconnect();
			},
		};
		onConnection({
			data: { userId },
			emit: (event: string) => fake.received.push(event),
			disconnect: () => fake.close(),
			on: (_event: string, handler: () => void) => {
				onDisconnect = handler;
			},
		});
		return fake;
	};

	return { io: io as unknown as Server, connect };
}

test("the same user in another browser: the old connection is told why and closed", () => {
	const server = fakeServer();
	setupOneConnectionPerUser(server.io);
	const chrome = server.connect(1);
	const firefox = server.connect(1);
	expect(chrome.received).toEqual(["session:replaced"]);
	expect(chrome.closed).toBe(true);
	expect(firefox.closed).toBe(false);
});

test("different users do not touch each other", () => {
	const server = fakeServer();
	setupOneConnectionPerUser(server.io);
	const ana = server.connect(1);
	const bia = server.connect(2);
	expect(ana.closed).toBe(false);
	expect(bia.closed).toBe(false);
});

test("after the new one closes, the user can connect again without closing anyone", () => {
	const server = fakeServer();
	setupOneConnectionPerUser(server.io);
	server.connect(1);
	const second = server.connect(1);
	second.close();
	const third = server.connect(1);
	expect(third.received).toEqual([]);
	expect(second.received).toEqual([]);
});
