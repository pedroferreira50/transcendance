import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

const { mockFindUnique } = vi.hoisted(() => ({
    mockFindUnique: vi.fn(),
}));

vi.mock("../database", () => ({ default: {} }));
vi.mock("../prisma", () => ({
    default: { user: { findUnique: mockFindUnique } },
}));

let server: Server | undefined;
let baseUrl = "";
let signToken: (userId: number) => string;

beforeAll(async () => {
    process.env.JWT_SECRET = "test-only-secret";

    const [{ default: authRoutes }, auth] = await Promise.all([
        import("../authRoutes"),
        import("../auth"),
    ]);
    signToken = auth.signToken;

    const app = express();
    app.use(authRoutes);

    const httpServer = createServer(app);
    server = httpServer;

    await new Promise<void>((resolve) => {
        httpServer.listen(0, "127.0.0.1", resolve);
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
        throw new Error("Could not start test server.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    const runningServer = server;
    if (!runningServer) return;

    await new Promise<void>((resolve, reject) => {
        runningServer.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
});

describe("GET /progression", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("rejects requests without login", async () => {
        const response = await fetch(`${baseUrl}/progression`);

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ message: "Not logged in." });
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    test("returns progression for the logged-in user", async () => {
        const unlockedAt = new Date("2026-01-02T03:04:05.000Z");
        mockFindUnique.mockResolvedValue({
            totalXp: 250,
            achievements: [{ achievementKey: "no_death_win", unlockedAt }],
            multiplayerWins: 7,
        });

        const response = await fetch(`${baseUrl}/progression`, {
            headers: { cookie: `token=${signToken(42)}` },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            totalXp: 250,
            level: 3,
            achievements: [{
                achievementKey: "no_death_win",
                unlockedAt: unlockedAt.toISOString(),
            }],
            multiplayerWins: 7,
            winsUntilTen: 3,
        });
        expect(mockFindUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 42 } }),
        );
    });
	test("reports zero wins remaining after reaching ten wins", async () => {
		mockFindUnique.mockResolvedValue({
			totalXp: 1000,
			achievements: [],
			multiplayerWins: 12,
		});

		const response = await fetch(`${baseUrl}/progression`, {
			headers: { cookie: `token=${signToken(42)}` },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			multiplayerWins: 12,
			winsUntilTen: 0,
		});
	});
});