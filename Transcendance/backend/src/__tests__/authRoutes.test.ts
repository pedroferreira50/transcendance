import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "vitest";
import argon2 from "argon2";
import express from "express";
import { createServer, type Server } from "node:http";

const { mockFindUnique, mockGet, mockPrepare } = vi.hoisted(() => ({
    mockFindUnique: vi.fn(),
    mockGet: vi.fn(),
    mockPrepare: vi.fn(),
}));

vi.mock("../database", () => ({
    default: {
        prepare: (sql: string) => {
            mockPrepare(sql);
            return { get: mockGet };
        },
    },
}));
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
    app.use(express.json());
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

describe("GET /session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("answers null for a visitor, without an error status", async () => {
        const response = await fetch(`${baseUrl}/session`);

        expect(response.status).toBe(200);
        expect(await response.json()).toBeNull();
        expect(mockGet).not.toHaveBeenCalled();
    });

    test("answers the logged-in user", async () => {
        mockGet.mockReturnValue({
            id: 7,
            username: "player",
            wins: 2,
            losses: 1,
            multiplayer_wins: 0,
            multiplayer_losses: 3,
        });

        const response = await fetch(`${baseUrl}/session`, {
            headers: { cookie: `token=${signToken(7)}` },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            id: 7,
            username: "player",
            wins: 2,
            losses: 1,
            multiplayerWins: 0,
            multiplayerLosses: 3,
        });
        expect(mockGet).toHaveBeenCalledWith(7);
    });

    test("answers null and clears the cookie when the account no longer exists", async () => {
        mockGet.mockReturnValue(undefined);

        const response = await fetch(`${baseUrl}/session`, {
            headers: { cookie: `token=${signToken(7)}` },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toBeNull();
        expect(response.headers.get("set-cookie")).toContain("token=;");
    });

    test("answers null and clears the cookie when the token is invalid", async () => {
        const response = await fetch(`${baseUrl}/session`, {
            headers: { cookie: "token=not-a-real-token" },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toBeNull();
        expect(response.headers.get("set-cookie")).toContain("token=;");
        expect(mockGet).not.toHaveBeenCalled();
    });
});

describe("POST /login", () => {
    let passwordHash = "";

    beforeAll(async () => {
        passwordHash = await argon2.hash("abcdef12");
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function login(identifier: unknown, password: unknown) {
        return fetch(`${baseUrl}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
        });
    }

    function storedUser() {
        return {
            id: 7,
            username: "player",
            password_hash: passwordHash,
            wins: 0,
            losses: 0,
            multiplayer_wins: 0,
            multiplayer_losses: 0,
        };
    }

    test("logs in with the username", async () => {
        mockGet.mockReturnValue(storedUser());

        const response = await login("player", "abcdef12");

        expect(response.status).toBe(200);
        expect(mockPrepare.mock.calls[0][0]).toContain("username = ?");
        expect(mockGet).toHaveBeenCalledWith("player");
    });

    test("logs in with the email, in any capitals", async () => {
        mockGet.mockReturnValue(storedUser());

        const response = await login("  Player@Example.COM ", "abcdef12");

        expect(response.status).toBe(200);
        expect(mockPrepare.mock.calls[0][0]).toContain("email = ?");
        expect(mockGet).toHaveBeenCalledWith("player@example.com");
    });

    test("gives the same error for a wrong password and an unknown email", async () => {
        mockGet.mockReturnValue(storedUser());
        const wrongPassword = await login("player", "wrongpass1");

        mockGet.mockReturnValue(undefined);
        const unknownEmail = await login("nobody@example.com", "abcdef12");

        expect(wrongPassword.status).toBe(401);
        expect(unknownEmail.status).toBe(401);
        expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    });

    test("rejects a missing username or email", async () => {
        const response = await login("", "abcdef12");

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ code: "auth.loginRequiredFields" });
        expect(mockGet).not.toHaveBeenCalled();
    });

    test("rejects a username that breaks the username rules without asking the database", async () => {
        const response = await login("averyveryverylongname", "abcdef12");

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ code: "auth.invalidCredentials" });
        expect(mockGet).not.toHaveBeenCalled();
    });
});