import type { MapSize } from "./types";

export const MOVE_COOLDOWN_MS = 150;
export const MONSTER_INTERVAL_MS = 500;
export const RESPAWN_DELAY_MS = 3000;
export const INVULNERABLE_MS = 1000;
export const SPEED_DURATION_MS = 5000;
export const FREEZE_DURATION_MS = 2000;
export const ENCHANT_DURATION_MS = 5000;
export const POWERUP_INTERVAL_MS = 5000;
export const MAX_POWERUPS_ON_MAP = 3;
export const MONSTER_MIN_SPAWN_DISTANCE = 4;
export const RECONNECT_TIMEOUT_MS = 30000;

export type SizeRules = {
	players: number[]; // how many players this size accepts
	goal: number; // diamonds each player needs
	monsters: number;
	timeLimitMs: number;
};

export const SIZE_RULES: Record<MapSize, SizeRules> = {
	small:  { players: [2],       goal: 5,  monsters: 4, timeLimitMs: 3 * 60_000 },
	medium: { players: [2, 3],    goal: 10, monsters: 6, timeLimitMs: 4 * 60_000 },
	large:  { players: [2, 3, 4], goal: 10, monsters: 8, timeLimitMs: 5 * 60_000 },
};

export function diamondCount(size: MapSize, playerCount: number): number {
	return SIZE_RULES[size].goal * playerCount + 1;
}
