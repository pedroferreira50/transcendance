import type { PrismaClient } from "./generated/prisma/client";

// A player's result in one match, as saved by persistence.ts.
export type MatchResult = "win" | "loss" | "draw" | "forfeit";

export type UserStats = {
	matches: number;
	wins: number;
	losses: number;
	draws: number;
	forfeits: number;
	diamonds: number;
	moves: number;
	deaths: number;
	powerUpsUsed: number;
	// Wins divided by decided matches (wins + losses + forfeits). Draws do not
	// count, like the old wins / (wins + losses) counters. One decimal place.
	winPercentage: number;
};

export type MatchHistoryItem = {
	id: string;
	mapName: string;
	startedAt: string;
	endedAt: string;
	endReason: string;
	character: string;
	result: MatchResult;
	diamonds: number;
	moves: number;
	deaths: number;
	powerUpsUsed: number;
	finishMs: number | null;
	opponents: {
		username: string;
		character: string;
		result: MatchResult;
	}[];
};

export type MatchHistoryPage = {
	matches: MatchHistoryItem[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

export type LeaderboardEntry = {
	rank: number;
	userId: number;
	username: string;
	stats: UserStats;
};

// What a history/statistics/leaderboard query needs from the database. The
// Prisma client satisfies it; tests can inject a temporary client.
type StatisticsDatabase = PrismaClient;

const PLAYER_STATS_SELECT = {
	result: true,
	diamonds: true,
	moves: true,
	deaths: true,
	powerUpsUsed: true,
} as const;

type PlayerStatsRow = {
	result: string;
	diamonds: number;
	moves: number;
	deaths: number;
	powerUpsUsed: number;
};

type HistoryPlayerRow = PlayerStatsRow & {
	userId: number;
	slot: number;
	character: string;
	finishMs: number | null;
	user: { username: string };
};

type HistoryMatchRow = {
	id: string;
	mapName: string;
	startedAt: Date;
	endedAt: Date;
	endReason: string;
	players: HistoryPlayerRow[];
};

// Totals are always calculated from MatchPlayer records, never from the old
// users counters. This keeps the API honest even while the legacy columns
// still exist.
export function summarizeMatches(players: readonly PlayerStatsRow[]): UserStats {
	const stats: UserStats = {
		matches: players.length,
		wins: 0,
		losses: 0,
		draws: 0,
		forfeits: 0,
		diamonds: 0,
		moves: 0,
		deaths: 0,
		powerUpsUsed: 0,
		winPercentage: 0,
	};

	for (const player of players) {
		stats.diamonds += player.diamonds;
		stats.moves += player.moves;
		stats.deaths += player.deaths;
		stats.powerUpsUsed += player.powerUpsUsed;

		if (player.result === "win")
			stats.wins++;
		else if (player.result === "loss")
			stats.losses++;
		else if (player.result === "draw")
			stats.draws++;
		else if (player.result === "forfeit")
			stats.forfeits++;
	}

	const decided = stats.wins + stats.losses + stats.forfeits;
	if (decided > 0)
		stats.winPercentage = Math.round((stats.wins / decided) * 1000) / 10;

	return stats;
}

// Leaderboard rule:
//   1. most wins;
//   2. highest win percentage;
//   3. username, case-insensitive, ascending (a stable last tie-break).
// Only players with at least one recorded match appear: a new account with no
// matches is not ranked above someone who has played.
export function rankLeaderboard(
	rows: readonly { userId: number; username: string; stats: UserStats }[],
): LeaderboardEntry[] {
	return rows
		.filter((row) => row.stats.matches > 0)
		.sort((a, b) =>
			b.stats.wins - a.stats.wins ||
			b.stats.winPercentage - a.stats.winPercentage ||
			a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
		)
		.map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function readUserStats(
	database: StatisticsDatabase,
	userId: number,
): Promise<{ userId: number; username: string; stats: UserStats } | null> {
	const user = await database.user.findUnique({
		where: { id: userId },
		select: { id: true, username: true },
	});

	if (!user)
		return null;

	const players = await database.matchPlayer.findMany({
		where: { userId },
		select: PLAYER_STATS_SELECT,
	});

	return {
		userId: user.id,
		username: user.username,
		stats: summarizeMatches(players),
	};
}

export async function readMatchHistory(
	database: StatisticsDatabase,
	userId: number,
	page: number,
	pageSize: number,
): Promise<MatchHistoryPage> {
	const [totalItems, matches] = await Promise.all([
		database.matchPlayer.count({ where: { userId } }),
		database.match.findMany({
			where: { players: { some: { userId } } },
			orderBy: [{ endedAt: "desc" }, { id: "asc" }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				mapName: true,
				startedAt: true,
				endedAt: true,
				endReason: true,
				players: {
					orderBy: { slot: "asc" },
					select: {
						...PLAYER_STATS_SELECT,
						userId: true,
						slot: true,
						character: true,
						finishMs: true,
						user: { select: { username: true } },
					},
				},
			},
		}),
	]);

	return {
		matches: matches.flatMap((match: HistoryMatchRow) => {
			const me = match.players.find((player: HistoryPlayerRow) => player.userId === userId);
			if (!me)
				return [];

			return [{
				id: match.id,
				mapName: match.mapName,
				startedAt: match.startedAt.toISOString(),
				endedAt: match.endedAt.toISOString(),
				endReason: match.endReason,
				character: me.character,
				result: me.result as MatchResult,
				diamonds: me.diamonds,
				moves: me.moves,
				deaths: me.deaths,
				powerUpsUsed: me.powerUpsUsed,
				finishMs: me.finishMs,
				opponents: match.players
					.filter((player: HistoryPlayerRow) => player.userId !== userId)
					.map((player: HistoryPlayerRow) => ({
						username: player.user.username,
						character: player.character,
						result: player.result as MatchResult,
					})),
			}];
		}),
		page,
		pageSize,
		totalItems,
		totalPages: Math.ceil(totalItems / pageSize),
	};
}

export async function readLeaderboard(
	database: StatisticsDatabase,
	limit: number,
): Promise<LeaderboardEntry[]> {
	const users = await database.user.findMany({
		select: {
			id: true,
			username: true,
			matchPlayers: { select: PLAYER_STATS_SELECT },
		},
	});

	return rankLeaderboard(users.map((user: { id: number; username: string; matchPlayers: PlayerStatsRow[] }) => ({
		userId: user.id,
		username: user.username,
		stats: summarizeMatches(user.matchPlayers),
	}))).slice(0, limit);
}
