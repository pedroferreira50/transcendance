import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import { PrismaClient } from "../generated/prisma/client";
import { GameRoom } from "../game/GameRoom";
import { loadMap } from "../game/mapLoader";
import { saveMatch } from "../persistence";

describe("saveMatch database transaction", () => {
	let temporaryDirectory: string | undefined;
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		if (prisma)
			await prisma.$disconnect();
		if (temporaryDirectory)
			rmSync(temporaryDirectory, { recursive: true, force: true });
	});

	test("rolls back match records and counters if a counter update fails", async () => {
		temporaryDirectory = mkdtempSync(join(tmpdir(), "transcendance-match-test-"));
		const databasePath = join(temporaryDirectory, "test.db");
		const setupDatabase = new Database(databasePath);

		for (const migration of [
			"20261109160000_baseline_users",
			"20261109170000_match_history",
		]) {
			setupDatabase.exec(readFileSync(
				resolve("prisma", "migrations", migration, "migration.sql"),
				"utf8",
			));
		}

		setupDatabase.prepare(
			"INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
		).run("winner", "winner@example.test", "hash");
		setupDatabase.prepare(
			"INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
		).run("loser", "loser@example.test", "hash");
		setupDatabase.exec(`
			CREATE TRIGGER reject_loss_counter
			BEFORE UPDATE OF multiplayer_losses ON users
			WHEN OLD.id = 2
			BEGIN
				SELECT RAISE(ABORT, 'simulated counter update failure');
			END;
		`);
		setupDatabase.close();

		const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` });
		prisma = new PrismaClient({ adapter });

		const room = new GameRoom(
			"rollback-match",
			"small-1",
			loadMap("small-1"),
			"small",
			[
				{ userId: 1, username: "winner", character: "goldfish" },
				{ userId: 2, username: "loser", character: "betta" },
			],
			{ local: false },
		);
		room.start(1000);
		room.state.players[0].diamonds = 3;
		room.endNow(5000);

		await expect(saveMatch(room.state, prisma)).rejects.toThrow();
		await prisma.$disconnect();
		prisma = undefined;

		const verificationDatabase = new Database(databasePath);
		const matchCount = verificationDatabase.prepare(
			"SELECT COUNT(*) AS count FROM matches",
		).get() as { count: number };
		const playerCount = verificationDatabase.prepare(
			"SELECT COUNT(*) AS count FROM match_players",
		).get() as { count: number };
		const users = verificationDatabase.prepare(
			"SELECT multiplayer_wins, multiplayer_losses FROM users ORDER BY id",
		).all() as { multiplayer_wins: number; multiplayer_losses: number }[];
		verificationDatabase.close();

		expect(matchCount.count).toBe(0);
		expect(playerCount.count).toBe(0);
		expect(users).toEqual([
			{ multiplayer_wins: 0, multiplayer_losses: 0 },
			{ multiplayer_wins: 0, multiplayer_losses: 0 },
		]);
	});
});
