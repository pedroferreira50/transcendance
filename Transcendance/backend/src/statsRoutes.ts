import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "./auth";
import type { PrismaClient } from "./generated/prisma/client";
import { readLeaderboard, readMatchHistory, readUserStats } from "./statistics";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const DEFAULT_LEADERBOARD_LIMIT = 10;
const MAX_LEADERBOARD_LIMIT = 100;

function parsePositiveInteger(raw: unknown, fallback: number, max: number): number | null {
	if (raw === undefined)
		return fallback;
	if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw))
		return null;

	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value > max)
		return null;

	return value;
}

function parseUserId(raw: string): number | null {
	if (!/^[1-9][0-9]*$/.test(raw))
		return null;

	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : null;
}

// A user can only read their own private history and statistics
function ownUserOrNone(req: Request, res: Response): number | null {
	if (req.userId === undefined) {
		res.status(401).json({ message: "Not logged in." });
		return null;
	}

	const idParam = req.params.id;
	if (typeof idParam !== "string") {
		res.status(400).json({ message: "Invalid user ID." });
		return null;
	}

	const userId = parseUserId(idParam);
	if (userId === null) {
		res.status(400).json({ message: "Invalid user ID." });
		return null;
	}

	if (userId !== req.userId) {
		res.status(403).json({ message: "You can only view your own data." });
		return null;
	}

	return userId;
}

//history, totals and leaderboard. The database is a
// parameter so tests can use a temporary database instead of users.db.
export function createStatsRouter(database: PrismaClient): Router {
	const router = Router();

	router.get("/users/:id/matches", requireAuth, async (req, res) => {
		const userId = ownUserOrNone(req, res);
		if (userId === null)
			return;

		const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
		const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

		if (page === null || pageSize === null) {
			res.status(400).json({
				message: `page and pageSize must be positive integers (pageSize at most ${MAX_PAGE_SIZE}).`,
			});
			return;
		}

		try {
			res.json(await readMatchHistory(database, userId, page, pageSize));
		} catch (error) {
			console.error(error);
			res.status(500).json({ message: "Could not load match history." });
		}
	});

	router.get("/users/:id/stats", requireAuth, async (req, res) => {
		const userId = ownUserOrNone(req, res);
		if (userId === null)
			return;

		try {
			const stats = await readUserStats(database, userId);
			if (!stats) {
				res.status(404).json({ message: "User not found." });
				return;
			}

			res.json(stats);
		} catch (error) {
			console.error(error);
			res.status(500).json({ message: "Could not load statistics." });
		}
	});

// The leaderboard is public: everyone can see it, logged in or not.
	router.get("/leaderboard", async (req, res) => {
		const limit = parsePositiveInteger(
			req.query.limit,
			DEFAULT_LEADERBOARD_LIMIT,
			MAX_LEADERBOARD_LIMIT,
		);

		if (limit === null) {
			res.status(400).json({
				message: `limit must be a positive integer at most ${MAX_LEADERBOARD_LIMIT}.`,
			});
			return;
		}

		try {
			res.json({ leaderboard: await readLeaderboard(database, limit) });
		} catch (error) {
			console.error(error);
			res.status(500).json({ message: "Could not load the leaderboard." });
		}
	});

	return router;
}
