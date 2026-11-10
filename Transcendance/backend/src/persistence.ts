import prisma from "./prisma";
import type { GameState } from "./game/types";

export async function saveMatch(state: GameState, database: typeof prisma = prisma): Promise<void> {
    if (state.local)
        return;

    if (
        state.status !== "finished" ||
        state.startedAt === null ||
        state.endedAt === null ||
        state.endReason === null
    ) {
        throw new Error("Cannot save an unfinished match");
    }

    const startedAt = state.startedAt;
    const endedAt = state.endedAt;
    const endReason = state.endReason;

    const players = state.players.map((player) => {
        if (player.userId === null)
            throw new Error(`Online match player ${player.slot} has no user ID`);

        const result =
            state.winnerSlot === null
                ? player.status === "left" ? "forfeit" : "draw"
                : player.slot === state.winnerSlot ? "win"
                : player.status === "left" ? "forfeit"
                : "loss";

        return {
            userId: player.userId,
            slot: player.slot,
            character: player.character,
            result,
            diamonds: player.diamonds,
            moves: player.moves,
            deaths: player.deaths,
            powerUpsUsed: player.powerUpsUsed,
            finishMs: endReason === "exit" && player.slot === state.winnerSlot ? endedAt - startedAt : null,
        };
    });

    const winner = players.find((player) => player.slot === state.winnerSlot);

    await database.$transaction(async (tx) => {
        await tx.match.create({
            data: {
                id: state.id,
                mapName: state.mapName,
                startedAt: new Date(startedAt),
                endedAt: new Date(endedAt),
                endReason,
                ...(winner ? { winner: { connect: { id: winner.userId } } } : {}),
                players: {
                    create: players,
                },
            },
        });

        for (const player of players) {
            if (player.result === "draw")
                continue;

            await tx.user.update({
                where: { id: player.userId },
                data: player.result === "win"
                    ? { multiplayerWins: { increment: 1 } }
                    : { multiplayerLosses: { increment: 1 } },
            });
        }
    });
}