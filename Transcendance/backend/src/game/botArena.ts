// The arena: bot against bot, without a screen and without waiting
//	npm run bot-arena -- [levelA] [levelB] [matches] [--options]
//	npm run bot-arena -- normal hard 200             -> 200 matches of NORMAL against HARD, default options
//	npm run bot-arena -- easy normal 100 --options   -> each match with options drawn at random
import { decide, keyDelay, newMemory } from "./bot";
import { BOT_LEVEL_NAMES, BOT_LEVELS, MATCH_TIMES, MONSTER_INTERVAL_MS, POWERUP_TYPES, SHARK_SPEEDS, defaultOptions } from "./config";
import { GameRoom } from "./GameRoom";
import { loadMap, mapsFor, mapSize } from "./mapLoader";
import type { BotLevel, EndReason, MatchOptions } from "./types";

// the fake clock moves in steps of this size: small enough for every timer of the match (the smallest is 140 ms)
const TICK_MS = 10;

// How one bot did in one match
export type ArenaFish = {
	level: BotLevel;
	result: "win" | "loss" | "draw";
	diamonds: number;
	deaths: number;
	powerUpsUsed: number;
};

export type ArenaMatch = {
	map: string;
	endReason: EndReason;
	durationMs: number;
	fish: [ArenaFish, ArenaFish]; // slot 0 and slot 1
};

// Plays a whole match between two bots with a fake clock (no waiting) and returns how each one did
export function playMatch(levels: [BotLevel, BotLevel], mapName: string, options: MatchOptions, random: () => number): ArenaMatch {
	const players = levels.map((level, slot) => ({ userId: null, username: `${level}-${slot}`, character: (["goldfish", "betta"] as const)[slot] }));
	const room = new GameRoom("arena", mapName, loadMap(mapName), mapSize(mapName), players, { local: true, match: options, random });
	const bots = levels.map((level, slot) => ({ slot, params: BOT_LEVELS[level], memory: newMemory(), nextKey: 0 }));
	const sharkMs = MONSTER_INTERVAL_MS[options.sharks];

	let now = 0;
	room.start(now);
	let nextSharks = sharkMs;
	let nextSecond = 1000;
	while (room.state.status !== "finished") {
		now += TICK_MS;
		if (now >= nextSharks) {
			room.tickMonsters(now);
			nextSharks += sharkMs;
		}
		if (now >= nextSecond) {
			room.tickSecond(now);
			nextSecond += 1000;
		}
		for (const bot of bots) {
			if (now < bot.nextKey)
				continue;
			bot.nextKey = now + keyDelay(room.state.players[bot.slot], now, bot.params);
			const action = decide(room.state, bot.slot, now, bot.memory, bot.params, options, random);
			if (action.usePowerUp)
				room.usePowerUp(bot.slot, now);
			if (action.dir)
				room.move(bot.slot, action.dir, now);
		}
		room.takeEvents(); // nobody listens to them here: emptied so the list does not grow
	}

	const state = room.state;
	const fish = state.players.map((p, slot): ArenaFish => ({
		level: levels[slot],
		result: state.winnerSlot === null ? "draw" : state.winnerSlot === slot ? "win" : "loss",
		diamonds: p.diamonds,
		deaths: p.deaths,
		powerUpsUsed: p.powerUpsUsed,
	}));
	return { map: mapName, endReason: state.endReason!, durationMs: now, fish: [fish[0], fish[1]] };
}

// Random but valid options: any time, any shark speed, any group of power-ups
export function randomOptions(random: () => number): MatchOptions {
	const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
	return {
		time: pick(MATCH_TIMES),
		sharks: pick(SHARK_SPEEDS),
		powerUps: POWERUP_TYPES.filter(() => random() < 0.5),
	};
}

type Totals = { 
	matches: number;
	wins: number;
	losses: number;
	draws: number;
	diamonds: number;
	deaths: number;
	powerUpsUsed: number;
	idle: number
};

// Adds up the numbers of one level on one side (slot 0 or 1) of all the matches
function totals(matches: ArenaMatch[], level: BotLevel, side: 0 | 1): Totals {
	const t: Totals = { matches: 0, wins: 0, losses: 0, draws: 0, diamonds: 0, deaths: 0, powerUpsUsed: 0, idle: 0 };
	for (const match of matches) {
		const f = match.fish[side];
		if (f.level !== level)
			continue;
		t.matches++;
		t[f.result === "win" ? "wins" : f.result === "loss" ? "losses" : "draws"]++;
		t.diamonds += f.diamonds;
		t.deaths += f.deaths;
		t.powerUpsUsed += f.powerUpsUsed;
		if (match.endReason === "timeout" && f.diamonds === 0)
			t.idle++; // the whole match without a single diamond: a bot that got stuck
	}
	return t;
}

// "64.7%", or "-" when there is nothing to divide by
function percent(part: number, whole: number): string {
	return whole === 0 ? "-" : `${((part / whole) * 100).toFixed(1)}%`;
}

// Reads the arguments, plays the matches and prints the table
function main(): void {
	const args = process.argv.slice(2);
	const randomOpts = args.includes("--options");
	const [a = "normal", b = "hard", count = "100"] = args.filter((arg) => !arg.startsWith("--"));
	const levelA = BOT_LEVEL_NAMES.find((l) => l === a);
	const levelB = BOT_LEVEL_NAMES.find((l) => l === b);
	const total = Number(count);
	if (!levelA || !levelB || !Number.isInteger(total) || total < 1) {
		console.error("usage: npm run bot-arena -- [easy|normal|hard] [easy|normal|hard] [matches] [--options]");
		process.exit(1);
	}

	const maps = mapsFor(2);
	const matches: ArenaMatch[] = [];
	const started = Date.now();
	for (let i = 0; i < total; i++) {
		// they take turns in slot 0 (the spawns are not the same), and the map changes every match
		const levels: [BotLevel, BotLevel] = i % 2 === 0 ? [levelA, levelB] : [levelB, levelA];
		const options = randomOpts ? randomOptions(Math.random) : defaultOptions();
		matches.push(playMatch(levels, maps[i % maps.length], options, Math.random));
	}

	console.log(`${total} matches: ${levelA.toUpperCase()} x ${levelB.toUpperCase()}`
		+ `${randomOpts ? ", random options" : ", default options"} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`);
	const rows = (levelA === levelB ? [levelA] : [levelA, levelB]).map((level) => {
		const both = [totals(matches, level, 0), totals(matches, level, 1)];
		const t = both.reduce((sum, x) => {
			for (const key of Object.keys(sum) as (keyof Totals)[])
				sum[key] += x[key];
			return sum;
		});
		return {
			level: level.toUpperCase(),
			wins: percent(t.wins, t.matches),
			losses: percent(t.losses, t.matches),
			draws: percent(t.draws, t.matches),
			"diamonds/match": (t.diamonds / t.matches).toFixed(1),
			"deaths/match": (t.deaths / t.matches).toFixed(1),
			"power-ups/match": (t.powerUpsUsed / t.matches).toFixed(1),
			"stuck (0 diamonds)": percent(t.idle, t.matches),
		};
	});
	console.table(rows);
	const reasons = ["exit", "timeout", "forfeit"].map((r) => `${r} ${percent(matches.filter((m) => m.endReason === r).length, total)}`);
	const minutes = matches.reduce((sum, m) => sum + m.durationMs, 0) / total / 60_000;
	console.log(`end of the matches: ${reasons.join(" · ")} · average length ${minutes.toFixed(1)} min`);
}

// only when run as a program (npm run bot-arena), not when a test imports playMatch
if (require.main === module)
	main();
