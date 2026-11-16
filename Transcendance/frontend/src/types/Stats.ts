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

export type MatchHistoryResponse = {
	matches: MatchHistoryItem[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

export type StatsResponse = {
	userId: number;
	username: string;
	stats: UserStats;
};

export type LeaderboardEntry = {
	rank: number;
	userId: number;
	username: string;
	stats: UserStats;
};

export type LeaderboardResponse = {
	leaderboard: LeaderboardEntry[];
};
