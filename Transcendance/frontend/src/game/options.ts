// The options of a match (lobby SETTINGS, PLAY LOCAL).
// COPY of MATCH_TIMES, SHARK_SPEEDS, POWERUP_TYPES and defaultOptions() of backend/src/game/config.ts
import type { MatchOptions, MatchTime, PowerUpType, SharkSpeed } from "./protocol";

export const TIMES: MatchTime[] = ["short", "normal", "long"];
export const SHARK_SPEEDS: SharkSpeed[] = ["slow", "normal", "fast"];
export const POWER_UPS: PowerUpType[] = ["speed", "freeze", "enchant"];

// what each time changes in the time of the map size (TIME_CHANGE_MS of the server)
export const TIME_CHANGE: Record<MatchTime, string> = { short: "-1 MIN", normal: "", long: "+2 MIN" };

// a new object each time: whoever receives it can change it without changing the one of someone else
export function defaultOptions(): MatchOptions {
	return { time: "normal", sharks: "normal", powerUps: [...POWER_UPS] };
}
