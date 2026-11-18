import { beforeEach, describe, expect, test, vi } from "vitest";
import { GameRoom } from "../game/GameRoom";
import { loadMap } from "../game/mapLoader";

const { mockCreate, mockUpdate, mockAchievementUpsert, mockTransaction } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockAchievementUpsert: vi.fn(),
    mockTransaction: vi.fn(),
}));

vi.mock("../prisma", () => ({
    default: { $transaction: mockTransaction },
}));

import { saveMatch } from "../persistence";

describe("saveMatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdate.mockResolvedValue({ multiplayerWins: 1 });
    });
    mockTransaction.mockImplementation(async (work) =>
        work({
            match: { create: mockCreate },
            user: { update: mockUpdate },
            userAchievement: { upsert: mockAchievementUpsert },
        }),
    );
    test("does not save a local match", async () => {
        const room = new GameRoom(
            "local-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: null, username: "Player 1", character: "goldfish" },
                { userId: null, username: "Player 2", character: "betta" },
            ],
            { local: true },
        );

        await saveMatch(room.state);

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockAchievementUpsert).not.toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });
    test("saves an online match and its player results", async () => {
        const room = new GameRoom(
            "online-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.players[0].diamonds = 2;
        room.endNow(5000);

        await saveMatch(room.state);

        expect(mockCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: "online-match",
                startedAt: new Date(1000),
                endedAt: new Date(5000),
                endReason: "timeout",
                winner: { connect: { id: 1 } },
                players: {
                    create: expect.arrayContaining([
                        expect.objectContaining({ userId: 1, result: "win" }),
                        expect.objectContaining({ userId: 2, result: "loss" }),
                    ]),
                },
            }),
        });
        expect(mockUpdate).toHaveBeenCalledTimes(4);

        expect(mockUpdate).toHaveBeenNthCalledWith(1, {
            where: { id: 1 },
            data: { totalXp: { increment: 20 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(2, {
            where: { id: 1 },
            data: { multiplayerWins: { increment: 1 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(3, {
            where: { id: 2 },
            data: { totalXp: { increment: 10 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(4, {
            where: { id: 2 },
            data: { multiplayerLosses: { increment: 1 } },
        });

        expect(mockAchievementUpsert).toHaveBeenCalledTimes(1);

        expect(mockAchievementUpsert).toHaveBeenCalledWith({
            where: {
                userId_achievementKey: {
                    userId: 1,
                    achievementKey: "no_death_win",
                },
            },
            create: {
                userId: 1,
                achievementKey: "no_death_win",
            },
            update: {},
        });
        expect(mockAchievementUpsert).not.toHaveBeenCalledWith({
            where: {
                userId_achievementKey: {
                    userId: 1,
                    achievementKey: "ten_online_wins",
                },
            },
            create: {
                userId: 1,
                achievementKey: "ten_online_wins",
            },
            update: {},
        });
    });
    test("does not award the no-death achievement if the winner died", async () => {
        const room = new GameRoom(
            "winner-died-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.players[0].diamonds = 2;
        room.state.players[0].deaths = 1;
        room.endNow(5000);

        await saveMatch(room.state);

        expect(mockAchievementUpsert).not.toHaveBeenCalled();
    });
    test("awards fast-exit achievement when the winner exits under 60 moves", async () => {
        const room = new GameRoom(
            "fast-exit-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.monsters = [];
        room.state.players[0].pos = { x: 9, y: 3 };
        room.state.players[0].diamonds = room.state.goal;
        room.state.players[0].moves = 58;
        room.state.players[0].deaths = 1;

        room.move(0, "down", 5000);

        expect(room.state.endReason).toBe("exit");
        expect(room.state.players[0].moves).toBe(59);

        await saveMatch(room.state);

        expect(mockAchievementUpsert).toHaveBeenCalledTimes(1);
        expect(mockAchievementUpsert).toHaveBeenCalledWith({
            where: {
                userId_achievementKey: {
                    userId: 1,
                    achievementKey: "fast_exit",
                },
            },
            create: {
                userId: 1,
                achievementKey: "fast_exit",
            },
            update: {},
        });
    });
    test("no award achievement is given for 60 moves", async () => {
        const room = new GameRoom(
            "fast-exit-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.monsters = [];
        room.state.players[0].pos = { x: 9, y: 3 };
        room.state.players[0].diamonds = room.state.goal;
        room.state.players[0].moves = 59;
        room.state.players[0].deaths = 1;

        room.move(0, "down", 5000);

        expect(room.state.endReason).toBe("exit");
        expect(room.state.players[0].moves).toBe(60);

        await saveMatch(room.state);

        expect(mockAchievementUpsert).not.toHaveBeenCalled();
    });
    test("does not award progression when saving a duplicate match", async () => {
        const room = new GameRoom(
            "duplicate-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.players[0].diamonds = 2;
        room.endNow(5000);

        await saveMatch(room.state);

        const updateCallsAfterFirstSave = mockUpdate.mock.calls.length;
        const achievementCallsAfterFirstSave = mockAchievementUpsert.mock.calls.length;

        // Simulate the database rejecting this match because its ID already exists.
        mockCreate.mockRejectedValueOnce(new Error("duplicate match ID"));

        await expect(saveMatch(room.state)).rejects.toThrow("duplicate match ID");

        expect(mockUpdate).toHaveBeenCalledTimes(updateCallsAfterFirstSave);
        expect(mockAchievementUpsert).toHaveBeenCalledTimes(achievementCallsAfterFirstSave);
    });
    test("saves a draw when players have equal diamonds", async () => {
        const room = new GameRoom(
            "draw-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.endNow(5000);

        await saveMatch(room.state);

        const savedData = mockCreate.mock.calls[0][0].data;
        expect(savedData.winner).toBeUndefined();

        expect(mockUpdate).toHaveBeenCalledTimes(2);

        expect(mockUpdate).toHaveBeenNthCalledWith(1, {
            where: { id: 1 },
            data: { totalXp: { increment: 10 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(2, {
            where: { id: 2 },
            data: { totalXp: { increment: 10 }},
        });

        expect(savedData.players.create).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ userId: 1, result: "draw" }),
                expect.objectContaining({ userId: 2, result: "draw" }),
            ]),
        );
    });
    test("awards the ten-win achievement when the player has ten wins", async () => {
        const room = new GameRoom(
            "ten-wins-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.state.players[0].diamonds = 2;
        room.state.players[0].deaths = 1;
        room.endNow(5000);

        mockUpdate.mockResolvedValue({ multiplayerWins: 10 });

        await saveMatch(room.state);

        expect(mockAchievementUpsert).toHaveBeenCalledTimes(1);
        expect(mockAchievementUpsert).toHaveBeenCalledWith({
            where: {
                userId_achievementKey: {
                    userId: 1,
                    achievementKey: "ten_online_wins",
                },
            },
            create: {
                userId: 1,
                achievementKey: "ten_online_wins",
            },
            update: {},
        });
    });
    test("records a player who leaves as a forfeit", async () => {
        const room = new GameRoom(
            "forfeit-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.leave(1, 5000);

        await saveMatch(room.state);

        const savedData = mockCreate.mock.calls[0][0].data;
        expect(savedData.endReason).toBe("forfeit");
        expect(savedData.winner).toEqual({ connect: { id: 1 } });
        expect(savedData.players.create).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ userId: 1, result: "win" }),
                expect.objectContaining({ userId: 2, result: "forfeit" }),
            ]),
        );

        expect(mockUpdate).toHaveBeenCalledTimes(3);

        expect(mockUpdate).toHaveBeenNthCalledWith(1, {
            where: { id: 1 },
            data: { totalXp: { increment: 20 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(2, {
            where: { id: 1 },
            data: { multiplayerWins: { increment: 1 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(3, {
            where: { id: 2 },
            data: { multiplayerLosses: { increment: 1 } },
        });
    });
    test("rejects an unfinished online match", async () => {
        const room = new GameRoom(
            "unfinished-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: 1, username: "Player 1", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        await expect(saveMatch(room.state)).rejects.toThrow(
            "Cannot save an unfinished match",
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });
    test("rejects an online player without a user ID", async () => {
        const room = new GameRoom(
            "missing-user-match",
            "small-1",
            loadMap("small-1"),
            "small",
            [
                { userId: null, username: "Guest", character: "goldfish" },
                { userId: 2, username: "Player 2", character: "betta" },
            ],
            { local: false },
        );

        room.start(1000);
        room.endNow(5000);

        await expect(saveMatch(room.state)).rejects.toThrow(
            "Online match player 0 has no user ID",
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });
});