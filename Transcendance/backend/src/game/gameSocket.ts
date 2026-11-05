import type { Server, Socket } from "socket.io";
import { CHARACTERS } from "./config";
import type { GameManager } from "./GameManager";
import { DIRECTIONS } from "./GameRoom";
import { mapsFor } from "./mapLoader";
import type { Character, Direction } from "./types";

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

// In a local match the command says which fish (the same keyboard moves both): only 0 or 1
export function readSlot(data: unknown): number | null {
	if (typeof data !== "object" || data === null || !("slot" in data))
		return null;
	if (data.slot === 0 || data.slot === 1)
		return data.slot;
	return null;
}

export type LocalSetup = {
	map: string; // "random" or a map for 2 players
	characters: [Character, Character]; // the fish of slot 0 and of slot 1, never the same
};

// local:start { map, characters }: the same care as readDirection, the data can be anything
export function readLocalSetup(data: unknown): LocalSetup | null {
	if (typeof data !== "object" || data === null || !("map" in data) || !("characters" in data))
		return null;
	const { map, characters } = data;
	if (typeof map !== "string" || (map !== "random" && !mapsFor(2).includes(map)))
		return null;
	if (!Array.isArray(characters) || characters.length !== 2 || characters[0] === characters[1])
		return null;
	const first = CHARACTERS.find((c) => c === characters[0]);
	const second = CHARACTERS.find((c) => c === characters[1]);
	if (!first || !second)
		return null;
	return { map, characters: [first, second] };
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

	// the fish this command moves: online, always the slot of the user; local, the slot in the data
	// (no risk here: in a local match both fish belong to this same user)
	const slotOf = (game: { slot: number; local: boolean }, data: unknown) => game.local ? readSlot(data) : game.slot;

	// PLAY LOCAL: a 1v1 on this keyboard. Only a logged in user (the socket only connects with a login),
	// and the GameManager refuses it if they are already in a match
	socket.on("local:start", (data: unknown) => {
		const userId: unknown = socket.data.userId;
		const setup = readLocalSetup(data);
		if (typeof userId !== "number" || !setup) {
			socket.emit("local:error", "Choose a map and two different fish.");
			return;
		}
		const players = setup.characters.map((character, slot) => (
			{ userId, username: `Player ${slot + 1}`, character, socketId: socket.id }
		));
		try {
			games.createGame({ players, map: setup.map, local: true });
		} catch (error) {
			socket.emit("local:error", error instanceof Error ? error.message : "Could not start the match.");
		}
	});

	socket.on("game:move", (data: unknown) => {
		const dir = readDirection(data);
		const game = current();
		if (!dir || !game)
			return;
		const slot = slotOf(game, data);
		if (slot === null)
			return;
		game.room.move(slot, dir, Date.now()); // GameRoom checks the rest (status, walls, cooldown...)
	});

	socket.on("game:usePowerUp", (data: unknown) => {
		const game = current();
		if (!game)
			return;
		const slot = slotOf(game, data);
		if (slot === null)
			return;
		game.room.usePowerUp(slot, Date.now());
	});

	// the "Leave" button: gives up the match (if only one is left, they win by forfeit)
	// Local: leave(0) is enough, only Player 2 is left and the match ends for both
	socket.on("game:leave", () => {
		const game = current();
		if (!game)
			return;
		if (game.local) {
			game.room.leave(0); // only Player 2 is left: the match ends now
		} else
			game.room.leave(game.slot);
	});

	// the « of a spectator: stops watching, the match goes on
	socket.on("game:unspectate", () => {
		games.unspectate(socket.id);
	});

	// closed the tab, lost the internet...: the fish waits RECONNECT_TIMEOUT_MS before it leaves (tickSecond)
	// Local: nobody is left to play, so the match ends now
	socket.on("disconnect", () => {
		games.unspectate(socket.id); // a spectator has no match of its own: it only stops watching
		const game = current();
		// another tab of the same user closing does not touch the match
		if (!game || game.socketId !== socket.id)
			return;
		if (game.local) {
			game.room.leave(0); // only Player 2 is left: the match ends now
		} else
			game.room.setConnected(game.slot, false, Date.now());
	});
}
