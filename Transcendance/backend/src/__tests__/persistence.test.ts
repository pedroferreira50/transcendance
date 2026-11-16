import { beforeEach, describe, expect, test, vi } from "vitest";
import { GameRoom } from "../game/GameRoom";
import { loadMap } from "../game/mapLoader";

const { mockCreate, mockUpdate, mockTransaction } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockTransaction: vi.fn(),
}));

vi.mock("../prisma", () => ({
    default: { $transaction: mockTransaction },
}));

import { saveMatch } from "../persistence";

describe("saveMatch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	mockTransaction.mockImplementation(async (work) =>
		work({
			match: { create: mockCreate },
			user: { update: mockUpdate },
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
		expect(mockUpdate).toHaveBeenNthCalledWith(1, {
			where: { id: 1 },
			data: { multiplayerWins: { increment: 1 } },
		});

		expect(mockUpdate).toHaveBeenNthCalledWith(2, {
			where: { id: 2 },
			data: { multiplayerLosses: { increment: 1 } },
		});
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
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(savedData.players.create).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ userId: 1, result: "draw" }),
				expect.objectContaining({ userId: 2, result: "draw" }),
			]),
		);
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

        expect(mockUpdate).toHaveBeenNthCalledWith(1, {
            where: { id: 1 },
            data: { multiplayerWins: { increment: 1 } },
        });

        expect(mockUpdate).toHaveBeenNthCalledWith(2, {
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