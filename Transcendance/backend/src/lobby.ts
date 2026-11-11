import type { Server, Socket } from "socket.io";
import db from "./database";
import { CHARACTERS } from "./game/config";
import type { GameManager, MatchPlayer } from "./game/GameManager";
import { mapsFor, type PlayerCount } from "./game/mapLoader";
import type { Character, DynamicState } from "./game/types";

// One player's state while sitting in a lobby, before any match has started.
type LobbyPlayer = {
    id: string; // socket id
    userId: number;
    username: string;
    character: Character | null; // the fish they chose (null = not chosen yet)
    ready: boolean;
};

// A lobby: its join code, who's host, its members, the settings the host
// chose, and the match it's currently running (if any - null while everyone's
// still readying up).
type Lobby = {
    code: string;
    hostId: string;
    players: LobbyPlayer[];
    seats: PlayerCount; // how many players the match needs (2, 3 or 4)
    map: string; // "random" or one of mapsFor(seats)
    gameId: string | null;
};

// IMPORANT!!!!!!!!!!! these work a bit like structs in C but they dont exist at runtime, they are just for type checking. Bit of a guideline more or less.

const LOBBY_LIST_ROOM = "lobby-list";

// All lobbies currently open, keyed by their join code.
const lobbies = new Map<string, Lobby>();
// Reverse lookup: which lobby code a given connected socket is currently in.
const socketLobby = new Map<string, string>();

// Generates a random 5-character lobby code, re-rolling until it's not already in use.
function generateLobbyCode(): string {
    let code: string;

    do {
        code = Math.random().toString(36).slice(2, 7).toUpperCase();
    } while (lobbies.has(code));

    return code;
}

function isUserInLobby(username: string): boolean {
    for (const lobby of lobbies.values()) {
        if (lobby.players.some((player) => player.username === username)) {
            return true;
        }
    }

    return false;
}

// The lobby this socket is in (undefined if none).
function findLobby(socketId: string): Lobby | undefined {
    const code = socketLobby.get(socketId);

    return code === undefined ? undefined : lobbies.get(code);
}

// lobby:settings comes from the browser, so it can be anything: only
// { seats: 2 | 3 | 4, map: "random" or a map for that many players } passes.
export function readSettings(data: unknown): { seats: PlayerCount; map: string } | null {
    if (typeof data !== "object" || data === null || !("seats" in data) || !("map" in data)) {
        return null;
    }

    const seats = data.seats;
    const map = data.map;

    if (seats !== 2 && seats !== 3 && seats !== 4) {
        return null;
    }

    if (typeof map !== "string" || (map !== "random" && !mapsFor(seats).includes(map))) {
        return null;
    }

    return { seats, map };
}

// lobby:spectate: only { code: string } passes.
export function readCode(data: unknown): string | null {
    if (typeof data !== "object" || data === null || !("code" in data) || typeof data.code !== "string") {
        return null;
    }

    return data.code;
}

// lobby:character: only one of the 4 fish names passes.
export function readCharacter(data: unknown): Character | null {
    for (const character of CHARACTERS) {
        if (data === character) {
            return character;
        }
    }

    return null;
}

// Shrinks a Lobby down to the small preview shown in the browsable lobby list
// (no per-player detail needed there, just a headline count and status).
function lobbySummary(lobby: Lobby) {
    return {
        code: lobby.code,
        hostUsername: lobby.players.find((player) => player.id === lobby.hostId)?.username ?? "",
        playerCount: lobby.players.length,
        seats: lobby.seats,
        map: lobby.map,
        inProgress: lobby.gameId !== null
    };
}

// Sends the current list of open lobbies to everyone browsing the lobby-select screen.
function broadcastLobbyList(io: Server) {
    const list = Array.from(lobbies.values()).map(lobbySummary);
    io.to(LOBBY_LIST_ROOM).emit("lobbyList:update", list);
}

// The full shape of one lobby that its own members need to see: who's in it,
// who's host, the settings, and each player's fish and ready status.
function lobbyState(lobby: Lobby) {
    return {
        code: lobby.code,
        hostId: lobby.hostId,
        seats: lobby.seats,
        map: lobby.map,
        players: lobby.players.map((player) => ({
            id: player.id,
            username: player.username,
            character: player.character,
            ready: player.ready
        }))
    };
}

// Sends the current lobby state to everyone already inside that lobby's room.
function broadcastLobby(io: Server, lobby: Lobby) {
    io.to(lobby.code).emit("lobby:update", lobbyState(lobby));
}

// Persists a finished match's outcome: +1 win for the winner, +1 loss for everyone else.
// TODO Etapa 7: moves to saveResult (GameManager), with the full match history.
function recordMultiplayerResult(winnerUsername: string, loserUsernames: string[]) {
    db.prepare(`UPDATE users SET multiplayer_wins = multiplayer_wins + 1 WHERE username = ?`).run(winnerUsername);

    for (const loserUsername of loserUsernames) {
        db.prepare(`UPDATE users SET multiplayer_losses = multiplayer_losses + 1 WHERE username = ?`).run(loserUsername);
    }
}

// Hands the lobby to the GameManager: slot = order in the lobby. From here on
// the match talks to the players with game:* events (GameManager, gameSocket).
function startMatch(io: Server, games: GameManager, lobby: Lobby) {
    const players: MatchPlayer[] = [];

    for (const player of lobby.players) {
        if (!player.character) {
            return;
        }

        players.push({ userId: player.userId, username: player.username, character: player.character, socketId: player.id });
    }

    try {
        lobby.gameId = games.createGame({
            players,
            map: lobby.map,
            onEnd: (final) => endMatch(io, lobby, players, final)
        });
    } catch (error) {
        // e.g. one of the players is still in another match
        io.to(lobby.code).emit("lobby:error", error instanceof Error ? error.message : "Could not start the match.");
        return;
    }

    broadcastLobbyList(io);
}

// Called by the GameManager when the match is over (time, forfeit or
// everyone left): records the win/loss (skipped for a draw) and resets the
// lobby so a rematch needs everyone to ready up again.
function endMatch(io: Server, lobby: Lobby, players: MatchPlayer[], final: DynamicState) {
    if (final.winnerSlot !== null) {
        const winner = players[final.winnerSlot];
        const losers = players
            .filter((_, slot) => slot !== final.winnerSlot)
            .map((player) => player.username);

        recordMultiplayerResult(winner.username, losers);
    }

    lobby.gameId = null;
    lobby.players.forEach((player) => {
        player.ready = false;
    });

    // Their seat was kept during the match, but they did not come back.
    for (const player of [...lobby.players]) {
        if (!io.sockets.sockets.has(player.id)) {
            handlePlayerLeavingLobby(io, player.id);
        }
    }

    broadcastLobby(io, lobby);
    broadcastLobbyList(io);
}

// A user who connects while their lobby is running a match: their seat answers
// to this socket now, and they get lobby:resume, to know where to go after the
// match (GameManager.rejoin sends game:resume right after, in gameSocket). If
// their fish already left the match, there is nothing to come back to, so they
// lose the seat.
function returnToLobby(io: Server, games: GameManager, socket: Socket) {
    for (const lobby of lobbies.values()) {
        const player = lobby.players.find((player) => player.userId === socket.data.userId);

        if (lobby.gameId === null || !player) {
            continue;
        }

        if (!games.canRejoin(socket.data.userId)) {
            handlePlayerLeavingLobby(io, player.id);
            return;
        }

        const oldId = player.id;

        socketLobby.delete(oldId);
        socketLobby.set(socket.id, lobby.code);
        player.id = socket.id;

        if (lobby.hostId === oldId) {
            lobby.hostId = socket.id;
        }

        socket.join(lobby.code);
        socket.emit("lobby:resume", lobbyState(lobby));
        broadcastLobby(io, lobby);
        return;
    }
}

// Shared cleanup for anyone leaving a lobby, whether by choice (lobby:leave),
// getting kicked, or just disconnecting. Removes them from the roster,
// deletes the lobby if it's now empty, and otherwise reassigns host if the
// host was the one who left. A match already running is not touched here:
// gameSocket handles game:leave and the disconnect.
function handlePlayerLeavingLobby(io: Server, socketId: string) {
    const code = socketLobby.get(socketId);

    if (!code) {
        return;
    }

    socketLobby.delete(socketId);

    const lobby = lobbies.get(code);

    if (!lobby) {
        return;
    }

    const index = lobby.players.findIndex((player) => player.id === socketId);

    if (index === -1) {
        return;
    }

    lobby.players.splice(index, 1);

    if (lobby.players.length === 0) {
        lobbies.delete(code);
    } else {
        if (lobby.hostId === socketId) {
            lobby.hostId = lobby.players[0].id;
        }

        broadcastLobby(io, lobby);
    }

    broadcastLobbyList(io);
}

// Registers every lobby socket event. Called once per connected client.
export function setupLobby(io: Server, games: GameManager) {
    io.on("connection", (socket: Socket) => {
        returnToLobby(io, games, socket);

        // Client is on the lobby-select screen: join the broadcast room for
        // list updates and hand them the current snapshot right away.
        socket.on("lobbyList:subscribe", () => {
            socket.join(LOBBY_LIST_ROOM);
            socket.emit("lobbyList:update", Array.from(lobbies.values()).map(lobbySummary));
        });

        // Creates a brand-new lobby with this socket as its sole player and host
        // (2 players and a random map until the host changes it).
        socket.on("lobby:create", (data: unknown) => {
            if (isUserInLobby(socket.data.username)) {
                socket.emit("lobby:error", "You are already in a lobby.");
                return;
            }

            // the players and the map chosen before creating; without them (or invalid): 2 players, random map
            const settings = readSettings(data);
            const code = generateLobbyCode();

            const lobby: Lobby = {
                code,
                hostId: socket.id,
                players: [{ id: socket.id, userId: socket.data.userId, username: socket.data.username, character: null, ready: false }],
                seats: settings ? settings.seats : 2,
                map: settings ? settings.map : "random",
                gameId: null
            };

            lobbies.set(code, lobby);
            socketLobby.set(socket.id, code);

            socket.leave(LOBBY_LIST_ROOM);
            socket.join(code);

            socket.emit("lobby:joined", lobbyState(lobby));
            broadcastLobbyList(io);
        });

        // Adds this socket to an existing lobby by code, after checking it
        // actually exists, isn't mid-match, and isn't already full.
        socket.on("lobby:join", ({ code }: { code: string }) => {
            if (isUserInLobby(socket.data.username)) {
                socket.emit("lobby:error", "You are already in a lobby.");
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby) {
                socket.emit("lobby:error", "Lobby not found.");
                return;
            }

            if (lobby.gameId !== null) {
                socket.emit("lobby:error", "Match already in progress.");
                return;
            }

            if (lobby.players.length >= lobby.seats) {
                socket.emit("lobby:error", "Lobby is full.");
                return;
            }

            lobby.players.push({ id: socket.id, userId: socket.data.userId, username: socket.data.username, character: null, ready: false });
            socketLobby.set(socket.id, code);

            socket.leave(LOBBY_LIST_ROOM);
            socket.join(code);

            socket.emit("lobby:joined", lobbyState(lobby));
            broadcastLobby(io, lobby);
            broadcastLobbyList(io);
        });

        // Lets a socket watch a lobby's running match.
        socket.on("lobby:spectate", (data: unknown) => {
            const code = readCode(data);
            const lobby = code === null ? undefined : lobbies.get(code);

            if (!lobby || lobby.gameId === null) {
                socket.emit("lobby:error", "There is no match to watch.");
                return;
            }

            if (isUserInLobby(socket.data.username)) {
                socket.emit("lobby:error", "You are already in a lobby.");
                return;
            }

            try {
                games.spectate(lobby.gameId, socket.id, socket.data.userId);
            } catch (error) {
                socket.emit("lobby:error", error instanceof Error ? error.message : "Could not watch the match.");
                return;
            }

            socket.leave(LOBBY_LIST_ROOM);
        });

        // Host-only: number of players (2, 3 or 4) and map. Never fewer seats
        // than the players already inside. Everyone has to ready up again,
        // since they agreed to the old settings.
        socket.on("lobby:settings", (data: unknown) => {
            const lobby = findLobby(socket.id);
            const settings = readSettings(data);

            if (!lobby || lobby.gameId !== null || lobby.hostId !== socket.id || !settings) {
                return;
            }

            if (settings.seats < lobby.players.length) {
                socket.emit("lobby:error", "There are more players than that in the lobby.");
                return;
            }

            lobby.seats = settings.seats;
            lobby.map = settings.map;
            lobby.players.forEach((player) => {
                player.ready = false;
            });

            broadcastLobby(io, lobby);
            broadcastLobbyList(io);
        });

        // Chooses this player's fish. Two players can't have the same one.
        socket.on("lobby:character", (data: unknown) => {
            const lobby = findLobby(socket.id);
            const character = readCharacter(data);

            if (!lobby || lobby.gameId !== null || !character) {
                return;
            }

            const player = lobby.players.find((player) => player.id === socket.id);

            if (!player) {
                return;
            }

            if (lobby.players.some((other) => other !== player && other.character === character)) {
                socket.emit("lobby:error", "That fish was already chosen.");
                return;
            }

            player.character = character;
            broadcastLobby(io, lobby);
        });

        // Toggles this player's ready flag (only after choosing a fish).
        // Starting the match is a separate, host-only step (lobby:start) -
        // readying up alone doesn't start anything.
        socket.on("lobby:ready", () => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || lobby.gameId !== null) {
                return;
            }

            const player = lobby.players.find((player) => player.id === socket.id);

            if (!player) {
                return;
            }

            if (!player.character) {
                socket.emit("lobby:error", "Choose a fish first.");
                return;
            }

            player.ready = !player.ready;
            broadcastLobby(io, lobby);
        });

        // Host-only: starts the match, but only once every seat is taken and
        // every player is ready.
        socket.on("lobby:start", () => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || lobby.gameId !== null || lobby.hostId !== socket.id) {
                return;
            }

            const allReady = lobby.players.length === lobby.seats && lobby.players.every((player) => player.ready);

            if (allReady) {
                startMatch(io, games, lobby);
            }
        });

        // Host-only: removes another player from the lobby and tells them
        // specifically that they were kicked (separate from a normal leave).
        socket.on("lobby:kick", (targetId: string) => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || lobby.gameId !== null || lobby.hostId !== socket.id || targetId === socket.id) {
                return;
            }

            const targetExists = lobby.players.some((player) => player.id === targetId);

            if (!targetExists) {
                return;
            }

            handlePlayerLeavingLobby(io, targetId);

            const targetSocket = io.sockets.sockets.get(targetId);

            if (targetSocket) {
                targetSocket.leave(code);
                targetSocket.emit("lobby:kicked");
            }
        });

        // Player chose to leave their current lobby voluntarily (the Back button).
        socket.on("lobby:leave", () => {
            const code = socketLobby.get(socket.id);

            handlePlayerLeavingLobby(io, socket.id);

            if (code) {
                socket.leave(code);
            }
        });

        // Browser closed, connection dropped, or the dev server restarted -
        // treat it like a voluntary lobby:leave. Not during a match: the seat
        // waits for them (returnToLobby), or for the end of the match (endMatch).
        socket.on("disconnect", () => {
            const lobby = findLobby(socket.id);

            if (lobby && lobby.gameId !== null) {
                return;
            }

            handlePlayerLeavingLobby(io, socket.id);
        });
    });
}
