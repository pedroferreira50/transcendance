// The options of a match (lobby SETTINGS, PLAY LOCAL, PLAY vs BOT) and the fish a player can choose.
// COPY of CHARACTERS, MATCH_TIMES, SHARK_SPEEDS, POWERUP_TYPES, TIME_CHANGE_MS, BOT_LEVEL_NAMES and defaultOptions() of backend/src/game/config.ts
import type { BotLevel, Character, MatchOptions, MatchTime, PowerUpType, SharkSpeed } from "./protocol";

export const CHARACTERS: Character[] = ["goldfish", "betta", "angler", "puffer"]; // the order of the FISH screens
export const TIMES: MatchTime[] = ["short", "normal", "long"];
export const SHARK_SPEEDS: SharkSpeed[] = ["slow", "normal", "fast"];
export const POWER_UPS: PowerUpType[] = ["speed", "freeze", "enchant"];
export const BOT_LEVELS: BotLevel[] = ["easy", "normal", "hard"]; // the order of the LEVEL screen (PLAY vs BOT)

// what each time adds to the time of the map size; the OPTIONS screen shows it in minutes ("-1 MIN", "+2 MIN")
export const TIME_CHANGE_MS: Record<MatchTime, number> = { short: -60_000, normal: 0, long: 2 * 60_000 };

// a new object each time: whoever receives it can change it without changing the one of someone else
export function defaultOptions(): MatchOptions {
	return { time: "normal", sharks: "normal", powerUps: [...POWER_UPS] };
}
