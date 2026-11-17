// The options of a match (lobby SETTINGS, PLAY LOCAL).
// COPY of MATCH_TIMES, SHARK_SPEEDS, POWERUP_TYPES, TIME_CHANGE_MS and defaultOptions() of backend/src/game/config.ts
import type { MatchOptions, MatchTime, PowerUpType, SharkSpeed } from "./protocol";

export const TIMES: MatchTime[] = ["short", "normal", "long"];
export const SHARK_SPEEDS: SharkSpeed[] = ["slow", "normal", "fast"];
export const POWER_UPS: PowerUpType[] = ["speed", "freeze", "enchant"];

// what each time adds to the time of the map size; the OPTIONS screen shows it in minutes ("-1 MIN", "+2 MIN")
export const TIME_CHANGE_MS: Record<MatchTime, number> = { short: -60_000, normal: 0, long: 2 * 60_000 };

// a new object each time: whoever receives it can change it without changing the one of someone else
export function defaultOptions(): MatchOptions {
	return { time: "normal", sharks: "normal", powerUps: [...POWER_UPS] };
}
