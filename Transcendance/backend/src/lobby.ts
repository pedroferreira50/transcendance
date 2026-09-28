import type { Server, Socket } from "socket.io";
import db from "./database";

// One player's state while a match is actually running (seat index, click count,
// whether they're still connected/participating).
type MatchPlayer = {
    id: string;
    username: string;
    clicks: number;
    active: boolean;
};

// The in-progress game itself: the seated players, the countdown, and the
// interval timer driving it.
type Match = {
    players: MatchPlayer[];
    secondsLeft: number;
    interval: ReturnType<typeof setInterval>;
};

// One player's state while sitting in a lobby, before any match has started.
type LobbyPlayer = {
    id: string;
    username: string;
    ready: boolean;
};

// A lobby: its join code, who's host, its members, and the match it's
// currently running (if any - null while everyone's still readying up).
type Lobby = {
    code: string;
    hostId: string;
    players: LobbyPlayer[];
    match: Match | null;
};

// IMPORANT!!!!!!!!!!! these work a bit like structs in C but they dont exist at runtime, they are just for type checking. Bit of a guideline more or less.

const MATCH_DURATION = 2000;
const MAX_PLAYERS = 8;
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

// Shrinks a Lobby down to the small preview shown in the browsable lobby list
// (no per-player detail needed there, just a headline count and status).
function lobbySummary(lobby: Lobby) {
    return {
        code: lobby.code,
        hostUsername: lobby.players.find((player) => player.id === lobby.hostId)?.username ?? "",
        playerCount: lobby.players.length,
        inProgress: lobby.match !== null
    };
}

// Sends the current list of open lobbies to everyone browsing the lobby-select screen.
function broadcastLobbyList(io: Server) {
    const list = Array.from(lobbies.values()).map(lobbySummary);
    io.to(LOBBY_LIST_ROOM).emit("lobbyList:update", list);
}

// The full shape of one lobby that its own members need to see: who's in it,
// who's host, and each player's ready status.
function lobbyState(lobby: Lobby) {
    return {
        code: lobby.code,
        hostId: lobby.hostId,
        players: lobby.players.map((player) => ({
            id: player.id,
            username: player.username,
            ready: player.ready
        }))
    };
}

// Sends the current lobby state to everyone already inside that lobby's room.
function broadcastLobby(io: Server, lobby: Lobby) {
    io.to(lobby.code).emit("lobby:update", lobbyState(lobby));
}

// The live click counts for an in-progress match, sent after every click and every tick.
function matchUpdatePayload(match: Match) {
    return {
        clicks: match.players.map((player) => player.clicks)
    };
}

// Persists a finished match's outcome: +1 win for the winner, +1 loss for everyone else.
function recordMultiplayerResult(winnerUsername: string, loserUsernames: string[]) {
    db.prepare(`UPDATE users SET multiplayer_wins = multiplayer_wins + 1 WHERE username = ?`).run(winnerUsername);

    for (const loserUsername of loserUsernames) {
        db.prepare(`UPDATE users SET multiplayer_losses = multiplayer_losses + 1 WHERE username = ?`).run(loserUsername);
    }
}

// Reads one user's current multiplayer win/loss totals out of the database,
// so we can hand each player their updated stats right when a match ends.
function getMultiplayerStats(username: string) {
    const row = db
        .prepare(`SELECT multiplayer_wins, multiplayer_losses FROM users WHERE username = ?`)
        .get(username) as { multiplayer_wins: number; multiplayer_losses: number } | undefined;

    return {
        multiplayerWins: row?.multiplayer_wins ?? 0,
        multiplayerLosses: row?.multiplayer_losses ?? 0
    };
}

// Kicks off a match for every player currently in the lobby: builds the match
// roster (seat index = order in the lobby), starts the per-second countdown
// that ends the match at zero, and tells each player their own seat number.
function startMatch(io: Server, lobby: Lobby) {
    const matchPlayers: MatchPlayer[] = lobby.players.map((player) => ({
        id: player.id,
        username: player.username,
        clicks: 0,
        active: true
    }));

    lobby.match = {
        players: matchPlayers,
        secondsLeft: MATCH_DURATION,
        interval: setInterval(() => {
            if (!lobby.match) {
                return;
            }

            lobby.match.secondsLeft -= 1;

            io.to(lobby.code).emit("match:tick", lobby.match.secondsLeft);

            if (lobby.match.secondsLeft <= 0) {
                const maxClicks = Math.max(...lobby.match.players.map((player) => player.clicks));
                const topPlayers = lobby.match.players.filter((player) => player.clicks === maxClicks);
                const winnerIndex =
                    topPlayers.length === 1
                        ? lobby.match.players.indexOf(topPlayers[0])
                        : -1;

                endMatch(io, lobby, winnerIndex);
            }
        }, 1000)
    };

    const usernames = matchPlayers.map((player) => player.username);

    matchPlayers.forEach((player, index) => {
        io.to(player.id).emit("match:start", {
            you: index,
            usernames
        });
    });
}

// Wraps up a match (called on timeout, a forfeit, or a kick): stops the timer,
// records the win/loss in the database (skipped for a draw, winnerIndex -1),
// tells each player the final result, and resets the lobby so a rematch needs
// everyone to ready up again.
function endMatch(io: Server, lobby: Lobby, winnerIndex: number) {
    if (!lobby.match) {
        return;
    }

    clearInterval(lobby.match.interval);

    const matchPlayers = lobby.match.players;
    const clicks = matchUpdatePayload(lobby.match);

    if (winnerIndex >= 0) {
        const winner = matchPlayers[winnerIndex];
        const losers = matchPlayers
            .filter((_, index) => index !== winnerIndex)
            .map((player) => player.username);

        recordMultiplayerResult(winner.username, losers);
    }

    matchPlayers.forEach((player) => {
        io.to(player.id).emit("match:end", {
            ...clicks,
            winnerIndex,
            ...getMultiplayerStats(player.username)
        });
    });

    lobby.match = null;
    lobby.players.forEach((player) => {
        player.ready = false;
    });

    broadcastLobby(io, lobby);
    broadcastLobbyList(io);
}

// Shared cleanup for anyone leaving a lobby, whether by choice (lobby:leave),
// getting kicked, or just disconnecting. Removes them from the roster, marks
// them inactive in an in-progress match (ending it early if that leaves 0-1
// active players left), deletes the lobby if it's now empty, and otherwise
// reassigns host if the host was the one who left.
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

    if (lobby.match) {
        const matchPlayer = lobby.match.players.find((player) => player.id === socketId);

        if (matchPlayer) {
            matchPlayer.active = false;

            const stillActive = lobby.match.players.filter((player) => player.active);

            if (stillActive.length <= 1) {
                const winnerIndex =
                    stillActive.length === 1
                        ? lobby.match.players.indexOf(stillActive[0])
                        : -1;

                endMatch(io, lobby, winnerIndex);
            }
        }
    }

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

// Registers every lobby/match socket event. Called once per connected client.
export function setupLobby(io: Server) {
    io.on("connection", (socket: Socket) => {
        // Client is on the lobby-select screen: join the broadcast room for
        // list updates and hand them the current snapshot right away.
        socket.on("lobbyList:subscribe", () => {
            socket.join(LOBBY_LIST_ROOM);
            socket.emit("lobbyList:update", Array.from(lobbies.values()).map(lobbySummary));
        });

        // Creates a brand-new lobby with this socket as its sole player and host.
        socket.on("lobby:create", (username: string) => {
            const code = generateLobbyCode();

            const lobby: Lobby = {
                code,
                hostId: socket.id,
                players: [{ id: socket.id, username, ready: false }],
                match: null
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
        socket.on("lobby:join", ({ code, username }: { code: string; username: string }) => {
            const lobby = lobbies.get(code);

            if (!lobby) {
                socket.emit("lobby:error", "Lobby not found.");
                return;
            }

            if (lobby.match) {
                socket.emit("lobby:error", "Match already in progress.");
                return;
            }

            if (lobby.players.length >= MAX_PLAYERS) {
                socket.emit("lobby:error", "Lobby is full.");
                return;
            }

            lobby.players.push({ id: socket.id, username, ready: false });
            socketLobby.set(socket.id, code);

            socket.leave(LOBBY_LIST_ROOM);
            socket.join(code);

            socket.emit("lobby:joined", lobbyState(lobby));
            broadcastLobby(io, lobby);
            broadcastLobbyList(io);
        });

        // Toggles this player's ready flag. Starting the match is a separate,
        // host-only step (lobby:start) - readying up alone doesn't start anything.
        socket.on("lobby:ready", () => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || lobby.match) {
                return;
            }

            const player = lobby.players.find((player) => player.id === socket.id);

            if (!player) {
                return;
            }

            player.ready = !player.ready;
            broadcastLobby(io, lobby);
        });

        // Host-only: starts the match, but only once there are 2+ players and
        // every one of them is ready.
        socket.on("lobby:start", () => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || lobby.match || lobby.hostId !== socket.id) {
                return;
            }

            const allReady = lobby.players.length >= 2 && lobby.players.every((player) => player.ready);

            if (allReady) {
                startMatch(io, lobby);
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

            if (!lobby || lobby.match || lobby.hostId !== socket.id || targetId === socket.id) {
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
            handlePlayerLeavingLobby(io, socket.id);
        });

        // Registers one click for whichever match this socket is currently
        // playing in, then broadcasts the updated click counts to that match.
        socket.on("match:click", () => {
            const code = socketLobby.get(socket.id);

            if (!code) {
                return;
            }

            const lobby = lobbies.get(code);

            if (!lobby || !lobby.match) {
                return;
            }

            const player = lobby.match.players.find((player) => player.id === socket.id);

            if (!player || !player.active) {
                return;
            }

            player.clicks += 1;

            const payload = matchUpdatePayload(lobby.match);

            lobby.match.players.forEach((matchPlayer) => {
                io.to(matchPlayer.id).emit("match:update", payload);
            });
        });

        // Browser closed, connection dropped, or the dev server restarted -
        // treat it exactly like a voluntary lobby:leave.
        socket.on("disconnect", () => {
            handlePlayerLeavingLobby(io, socket.id);
        });
    });
}
