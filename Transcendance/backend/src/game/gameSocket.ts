import type { Server, Socket } from "socket.io";
import type { GameManager } from "./GameManager";
import { DIRECTIONS } from "./GameRoom";
import type { Direction } from "./types";

// What the browser sends can be anything (an old version, a bug, someone typing in the console):
// only { dir: "up" | "down" | "left" | "right" } becomes a Direction, everything else is null
export function readDirection(data: unknown): Direction | null {
	if (typeof data !== "object" || data === null || !("dir" in data))
		return null;
	for (const dir of DIRECTIONS)
		if (data.dir === dir)
			return dir;
	return null;
}

// server.ts will call, once: every socket that connects gets the game events
export function setupGameSocket(io: Server, games: GameManager): void {
	io.on("connection", (socket) => registerGameEvents(socket, games));
}

// SECURITY: the data says WHAT to do, never WHO is doing it.
// The player is found by the socket (socket.data.userId, filled by the server at login, the browser can not touch it),
// never by a field of the data: if the browser could send { dir: "up", slot: 1 },
// anyone could move someone else's fish from the console (F12).
// Everything that comes from the browser is unknown until it is checked (readDirection).
export function registerGameEvents(socket: Socket, games: GameManager): void {
	// the match and the slot of this socket's user, or null (not logged in, or not in a match)
	const current = () => {
		const userId: unknown = socket.data.userId;
		if (typeof userId !== "number")
			return null;
		return games.find(userId);
	};

	socket.on("game:move", (data: unknown) => {
		const dir = readDirection(data);
		const game = current();
		if (!dir || !game)
			return;
		game.room.move(game.slot, dir, Date.now()); // GameRoom checks the rest (status, walls, cooldown...)
	});

	socket.on("game:usePowerUp", () => {
		const game = current();
		if (!game)
			return;
		game.room.usePowerUp(game.slot, Date.now());
	});

	// the "Leave" button: gives up the match (if only one is left, they win by forfeit)
	socket.on("game:leave", () => {
		const game = current();
		if (!game)
			return;
		game.room.leave(game.slot);
	});

	// closed the tab, lost the internet...: the fish waits RECONNECT_TIMEOUT_MS before it leaves (tickSecond)
	socket.on("disconnect", () => {
		const game = current();
		// another tab of the same user closing does not touch the match
		if (!game || game.socketId !== socket.id)
			return;
		game.room.setConnected(game.slot, false, Date.now());
	});
}
