import type { Server, Socket } from "socket.io";
import db from "./database";

type MatchPlayer = {
    id: string;
    username: string;
    clicks: number;
};

type Match = {
    player1: MatchPlayer;
    player2: MatchPlayer;
    secondsLeft: number;
    interval: ReturnType<typeof setInterval>;
};

const MATCH_DURATION = 10;

const players = new Map<string, string>();
let currentMatch: Match | null = null;

function broadcastLobby(io: Server) {
    io.emit("lobby:update", Array.from(players.values()));
}

function matchUpdatePayload(match: Match) {
    return {
        player1Clicks: match.player1.clicks,
        player2Clicks: match.player2.clicks
    };
}

function recordMultiplayerResult(winnerUsername: string, loserUsername: string) {
    db.prepare(`UPDATE users SET multiplayer_wins = multiplayer_wins + 1 WHERE username = ?`).run(winnerUsername);
    db.prepare(`UPDATE users SET multiplayer_losses = multiplayer_losses + 1 WHERE username = ?`).run(loserUsername);
}

function getMultiplayerStats(username: string) {
    const row = db
        .prepare(`SELECT multiplayer_wins, multiplayer_losses FROM users WHERE username = ?`)
        .get(username) as { multiplayer_wins: number; multiplayer_losses: number } | undefined;

    return {
        multiplayerWins: row?.multiplayer_wins ?? 0,
        multiplayerLosses: row?.multiplayer_losses ?? 0
    };
}

function endMatch(io: Server, winner: 0 | 1 | 2) {
    if (!currentMatch) {
        return;
    }

    clearInterval(currentMatch.interval);

    const { player1, player2 } = currentMatch;
    const clicks = matchUpdatePayload(currentMatch);

    if (winner === 1) {
        recordMultiplayerResult(player1.username, player2.username);
    } else if (winner === 2) {
        recordMultiplayerResult(player2.username, player1.username);
    }

    io.to(player1.id).emit("match:end", {
        ...clicks,
        winner,
        ...getMultiplayerStats(player1.username)
    });

    io.to(player2.id).emit("match:end", {
        ...clicks,
        winner,
        ...getMultiplayerStats(player2.username)
    });

    currentMatch = null;
}

export function setupLobby(io: Server) {
    io.on("connection", (socket: Socket) => {
        socket.on("lobby:join", (username: string) => {
            players.set(socket.id, username);
            broadcastLobby(io);
        });

        socket.on("lobby:play", () => {
            if (currentMatch || players.size < 2) {
                return;
            }

            const [[id1, username1], [id2, username2]] = Array.from(
                players.entries()
            );

            currentMatch = {
                player1: { id: id1, username: username1, clicks: 0 },
                player2: { id: id2, username: username2, clicks: 0 },
                secondsLeft: MATCH_DURATION,
                interval: setInterval(() => {
                    if (!currentMatch) {
                        return;
                    }

                    currentMatch.secondsLeft -= 1;

                    io.to(currentMatch.player1.id).emit(
                        "match:tick",
                        currentMatch.secondsLeft
                    );
                    io.to(currentMatch.player2.id).emit(
                        "match:tick",
                        currentMatch.secondsLeft
                    );

                    if (currentMatch.secondsLeft <= 0) {
                        const { player1, player2 } = currentMatch;
                        const winner =
                            player1.clicks === player2.clicks
                                ? 0
                                : player1.clicks > player2.clicks
                                  ? 1
                                  : 2;

                        endMatch(io, winner);
                    }
                }, 1000)
            };

            io.to(id1).emit("match:start", {
                playerNumber: 1,
                player1Username: username1,
                player2Username: username2
            });

            io.to(id2).emit("match:start", {
                playerNumber: 2,
                player1Username: username1,
                player2Username: username2
            });
        });

        socket.on("match:click", () => {
            if (!currentMatch) {
                return;
            }

            if (socket.id === currentMatch.player1.id) {
                currentMatch.player1.clicks += 1;
            } else if (socket.id === currentMatch.player2.id) {
                currentMatch.player2.clicks += 1;
            } else {
                return;
            }

            const payload = matchUpdatePayload(currentMatch);

            io.to(currentMatch.player1.id).emit("match:update", payload);
            io.to(currentMatch.player2.id).emit("match:update", payload);
        });

        socket.on("disconnect", () => {
            players.delete(socket.id);
            broadcastLobby(io);

            if (!currentMatch) {
                return;
            }

            if (socket.id === currentMatch.player1.id) {
                endMatch(io, 2);
            } else if (socket.id === currentMatch.player2.id) {
                endMatch(io, 1);
            }
        });
    });
}
