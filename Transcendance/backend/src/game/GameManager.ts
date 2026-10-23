import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { BROADCAST_INTERVAL_MS, COUNTDOWN_SECONDS, MONSTER_INTERVAL_MS } from "./config";
import { GameRoom, type PlayerInfo } from "./GameRoom";
import { loadMap, mapSize, pickMap, type PlayerCount } from "./mapLoader";
import type { DynamicState, GameStart, MapInfo } from "./types";

// The part of Socket.IO the manager uses. Like now and random in GameRoom, it comes from outside:
// in the server it is the real Socket.IO (ioTransport), in the tests a fake that writes down what was sent
export type Transport = {
	join(socketId: string, channel: string): void;
	leave(socketId: string, channel: string): void;
	toChannel(channel: string, event: string, data: unknown): void; // everyone in the channel
	toSocket(socketId: string, event: string, data: unknown): void; // only one player
};

// The real Transport: each of the 4 functions is an arrow function that calls Socket.IO
export function ioTransport(io: Server): Transport {
	return {
		join: (socketId, channel) => io.sockets.sockets.get(socketId)?.join(channel), // ?. = nothing happens if that socket is gone
		leave: (socketId, channel) => io.sockets.sockets.get(socketId)?.leave(channel),
		toChannel: (channel, event, data) => io.to(channel).emit(event, data),
		toSocket: (socketId, event, data) => io.to(socketId).emit(event, data),
	};
}

// A player as the lobby knows them: who they are and which socket is theirs
export type MatchPlayer = PlayerInfo & {
	userId: number; // online, every player is logged in
	socketId: string;
};

export type MatchSetup = {
	players: MatchPlayer[]; // index = slot
	map: string; // "random" or the name of a map for this number of players
	onEnd?: (final: DynamicState) => void; // called when the match is over (the lobby goes back to "ready")
};

// One match running: the rules (room) and everything around it
type Game = {
	id: string;
	channel: string; // Socket.IO room of the match: "game:<id>"
	room: GameRoom;
	players: MatchPlayer[];
	timers: ReturnType<typeof setInterval>[]; // all the intervals of the match, to stop them at the end
	onEnd?: (final: DynamicState) => void;
};

// All the matches of the server: creates them, runs their timers and sends what changes
// server.ts creates the only one: new GameManager(ioTransport(io))
export class GameManager {
	private games = new Map<string, Game>();
	private userGame = new Map<number, string>(); // userId -> id of the match they are in
	private transport: Transport;
	private random: () => number; // a function with no parameters that returns a number (Math.random, or seeded() in the tests)

	// random is optional: when it is not passed, Math.random is used
	constructor(transport: Transport, random: () => number = Math.random) {
		this.transport = transport;
		this.random = random;
	}

	// Starts a match: game:start for each player, then 3, 2, 1 (game:countdown) and the match begins
	// lobby.ts will call
	createGame(setup: MatchSetup): string {
		for (const player of setup.players) // refuses the match if one of the players is already in another one
			if (this.userGame.has(player.userId))
				throw new Error(`${player.username} is already in a match`); // Lobby handles and displays the error
		const mapName = pickMap(setup.players.length as PlayerCount, setup.map, this.random); // "random" -> one of the maps for this number of players
		const id = randomUUID(); // example: "3f2a9c1e-7b4d-4e8a-9c3f-1a2b3c4d5e6f"
		const room = new GameRoom(id, mapName, loadMap(mapName), mapSize(mapName), setup.players, { local: false, random: this.random });
		const game: Game = { id, channel: `game:${id}`, room, players: setup.players, timers: [], onEnd: setup.onEnd };
		this.games.set(id, game);

		// the fixed part of the map (walls, turtle) goes only once, here, and never again in game:state
		const map: MapInfo = { name: mapName, width: room.state.width, height: room.state.height, walls: room.state.walls, exit: room.state.exit };
		const state = room.snapshot(Date.now());
		room.dirty = false; // the state just went in game:start
		setup.players.forEach((player, slot) => {
			this.userGame.set(player.userId, id); // Save the match he is in
			this.transport.join(player.socketId, game.channel); // Add his socket to the game channel
			const start: GameStart = { gameId: id, map, you: slot, state };
			this.transport.toSocket(player.socketId, "game:start", start); // one by one: each player gets their own "you"
		});

		this.countdown(game);
		// the 'monsters' and the 'second' can start now: GameRoom ignores them until start() (status "running")
		game.timers.push(setInterval(() => game.room.tickMonsters(Date.now()), MONSTER_INTERVAL_MS));
		game.timers.push(setInterval(() => game.room.tickSecond(Date.now()), 1000));
		game.timers.push(setInterval(() => this.broadcast(game), BROADCAST_INTERVAL_MS));
		return id;
	}

	// The match and the slot of a user (null = not in a match) | gameSocket.ts will call
	find(userId: number): { room: GameRoom; slot: number; socketId: string } | null {
		const id = this.userGame.get(userId);
		const game = id === undefined ? undefined : this.games.get(id);
		if (!game)
			return null;
		const slot = game.players.findIndex((p) => p.userId === userId);
		return { room: game.room, slot, socketId: game.players[slot].socketId };
	}

	// How many matches are running (for the tests and, later, the logs)
	get count(): number {
		return this.games.size;
	}

	// 3, 2, 1 one per second; at 0 the clock of the match starts. Called once, by createGame
	private countdown(game: Game): void {
		let left = COUNTDOWN_SECONDS;
		this.transport.toChannel(game.channel, "game:countdown", left);
		const timer = setInterval(() => {
			left--;
			if (left > 0) {
				this.transport.toChannel(game.channel, "game:countdown", left);
				return;
			}
			clearInterval(timer);
			game.room.start(Date.now()); // dirty: the next broadcast sends the "running" state
		}, 1000);
		game.timers.push(timer); // so end() also stops it if everyone leaves during the countdown
	}

	// Every BROADCAST_INTERVAL_MS: what happened (game:event) and the new state (game:state), only if something changed
	private broadcast(game: Game): void {
		const events = game.room.takeEvents();
		if (game.room.dirty) {
			game.room.dirty = false;
			this.transport.toChannel(game.channel, "game:state", game.room.snapshot(Date.now()));
		}
		if (events.length > 0)
			this.transport.toChannel(game.channel, "game:event", events);
		if (game.room.state.status === "finished")
			this.end(game);
	}

	// Stops the timers, sends game:end, saves the result and forgets the match
	private end(game: Game): void {
		for (const timer of game.timers)
			clearInterval(timer);
		const final = game.room.snapshot(Date.now());
		this.transport.toChannel(game.channel, "game:end", final);
		saveResult(final);
		// free to join another match
		for (const player of game.players) {
			this.transport.leave(player.socketId, game.channel);
			this.userGame.delete(player.userId);
		}
		this.games.delete(game.id);
		if (game.onEnd)
			game.onEnd(final); // tells the lobby that the match is over
	}
}

// TODO Etapa 7: save the match and each player's result in the database
// the _ says the parameter is unused on purpose (for now)
function saveResult(_final: DynamicState): void {
}
