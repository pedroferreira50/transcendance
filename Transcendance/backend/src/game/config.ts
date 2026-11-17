import type { Character, MapSize, MatchOptions, MatchTime, PowerUpType, SharkSpeed } from "./types";

export const MOVE_COOLDOWN_MS = 100;
export const RESPAWN_DELAY_MS = 3000;
export const INVULNERABLE_MS = 1000;
export const SPEED_DURATION_MS = 5000;
export const FREEZE_DURATION_MS = 2000;
export const ENCHANT_DURATION_MS = 5000;
export const POWERUP_INTERVAL_MS = 5000;
export const MAX_POWERUPS_ON_MAP = 3;
export const MONSTER_MIN_SPAWN_DISTANCE = 4;
export const RECONNECT_TIMEOUT_MS = 30000;
export const COUNTDOWN_SECONDS = 3;
export const BROADCAST_INTERVAL_MS = 50; // how often the state is sent (only if something changed)
export const CHARACTERS: Character[] = ["goldfish", "betta", "angler", "puffer"]; // the fish a player can choose in the lobby
export const POWERUP_TYPES: PowerUpType[] = ["speed", "freeze", "enchant"];

// The options of the match (lobby SETTINGS, PLAY LOCAL)
export const MATCH_TIMES: MatchTime[] = ["short", "normal", "long"];
export const SHARK_SPEEDS: SharkSpeed[] = ["slow", "normal", "fast"];
// added to the time of the map size (small 2 min, medium 3, large 4)
export const TIME_CHANGE_MS: Record<MatchTime, number> = { short: -60_000, normal: 0, long: 2 * 60_000 };
// every how long each shark tries one step
export const MONSTER_INTERVAL_MS: Record<SharkSpeed, number> = { slow: 750, normal: 500, fast: 300 };

// What a match uses when nobody chose, and what a new lobby starts with (a new object each time: the lobby changes its own)
export function defaultOptions(): MatchOptions {
	return { time: "normal", sharks: "normal", powerUps: [...POWERUP_TYPES] };
}

export type SizeRules = {
	players: number[]; // how many players this size accepts
	goal: number; // diamonds each player needs
	monsters: number;
	timeLimitMs: number;
};

export const SIZE_RULES: Record<MapSize, SizeRules> = {
	small:  { players: [2],       goal: 5,  monsters: 4, timeLimitMs: 2 * 60_000 },
	medium: { players: [2, 3],    goal: 10, monsters: 6, timeLimitMs: 3 * 60_000 },
	large:  { players: [2, 3, 4], goal: 10, monsters: 8, timeLimitMs: 4 * 60_000 },
};

export function diamondCount(size: MapSize, playerCount: number): number {
	return SIZE_RULES[size].goal * playerCount + 1;
}
