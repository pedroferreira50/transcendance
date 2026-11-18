import { BOT_HURRY_MS, BOT_POWERUP_DETOUR, MONSTER_INTERVAL_MS } from "./config";
import { DIRECTIONS, step } from "./GameRoom";
import { posKey } from "./placement";
import type { BotParams, Direction, GameState, MatchOptions, Player, Position, PowerUp } from "./types";

// What the bot does not want to step on, besides the walls (sharks, dangerous cells, other fish)
export type Blocked = (pos: Position) => boolean;

const NOTHING_BLOCKED: Blocked = () => false;

// True for a wall, or for a cell outside the map
function isWall(walls: boolean[][], pos: Position): boolean {
	return walls[pos.y]?.[pos.x] ?? true;
}

/*
x:    0 1 2 3 4

y: 0  1 1 1 1 1
y: 1  1 A 1 E 1
y: 2  1 0 0 0 1
y: 3  1 1 1 1 1 
*/

// BFS: how many steps from `from` to every cell it can reach (a blocked cell gets a distance, but the search does not go through it)
export function distances(walls: boolean[][], from: Position, blocked: Blocked = NOTHING_BLOCKED): Map<string, number> {
	const dist = new Map([[posKey(from), 0]]);
	const queue = [from];
	for (let i = 0; i < queue.length; i++) {
		const { x, y } = queue[i];
		for (const next of [{ x: x + 1, y }, { x: x - 1, y}, { x, y: y + 1 }, { x, y: y - 1 }]) {
			if (isWall(walls, next) || dist.has(posKey(next)))
				continue;
			dist.set(posKey(next), dist.get(posKey({ x, y}))! + 1);
			if (!blocked(next))
				queue.push(next);
		}
	}
	return dist;
}

// BFS: the shortest way from `from` to `to` as a list of directions ([] = already there, null = no way); `to` itself is never blocked
export function findPath(walls: boolean[][], from: Position, to: Position, blocked: Blocked = NOTHING_BLOCKED): Direction[] | null {
	const target = posKey(to);
	const cameFrom = new Map<string, { prev: Position; dir: Direction } | null>([[posKey(from), null]]);
	const queue = [from];
	for (let i = 0; i < queue.length; i++) {
		const cell = queue[i];
		if (posKey(cell) === target)
			return rebuild(cameFrom, cell);
		for (const dir of DIRECTIONS) {
			const next = step(cell, dir);
			const key = posKey(next);
			if (isWall(walls, next) || cameFrom.has(key) || (key !== target && blocked(next)))
				continue;
			cameFrom.set(key, { prev: cell, dir });
			queue.push(next);
		}
	}
	return null;
}

// Builds the path of findPath: walks back from the end to the start, then reverses the list
function rebuild(cameFrom: Map<string, { prev: Position; dir: Direction } | null>, end: Position): Direction[] {
	const path: Direction[] = [];
	let link = cameFrom.get(posKey(end));
	while (link) {
		path.push(link.dir);
		link = cameFrom.get(posKey(link.prev));
	}
	return path.reverse();
}

// ----------------------------------------------------------------------------------
// The brain: perceive (look) -> danger -> target -> path -> power-up -> act (decide)
// ----------------------------------------------------------------------------------

// What the bot saw the last time it looked: a copy, not the live state of the match.
// Between two looks it decides with this copy, so it reacts late, like a person
export type BotView = {
	at: number; // when it looked
	monsters: Position[];
	monstersFrozenUntil: number;
	diamonds: Position[];
	powerUps: PowerUp[];
	others: { slot: number; pos: Position; diamonds: number; onMap: boolean }[]; // the other fish
};

// What the bot remembers from one decision to the next (one per bot, kept by whoever runs it)
export type BotMemory = {
	view: BotView | null; // null: it has not looked yet (start of the match, just came back to life)
	target: Position | null; // where it is going
};

export type BotAction = {
	dir: Direction | null; // null: it does not move now
	usePowerUp: boolean;
};

// An empty memory, for a new bot
export function newMemory(): BotMemory {
	return { view: null, target: null };
}

// Same cell?
const samePos = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
// Cells between a and b moving only up/down/left/right, ignoring the walls
const manhattan = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// False for a dead fish or one that left: they block nothing
function isOnMap(player: Player): boolean {
	return player.status !== "dead" && player.status !== "left";
}

// Takes a copy of the map as it is now: the bot decides with it until it looks again
export function look(state: GameState, slot: number, now: number): BotView {
	return {
		at: now,
		monsters: state.monsters.map((m) => ({ ...m })),
		monstersFrozenUntil: state.monstersFrozenUntil,
		diamonds: state.diamonds.map((d) => ({ ...d })),
		powerUps: state.powerUps.map((p) => ({ type: p.type, pos: { ...p.pos } })),
		others: state.players
			.filter((p) => p.slot !== slot)
			.map((p) => ({ slot: p.slot, pos: { ...p.pos }, diamonds: p.diamonds, onMap: isOnMap(p) })),
	};
}

// The cells too close to a shark it saw; the radius grows with the time since it looked and with the speed of the sharks
export function dangerCells(state: GameState, me: Player, view: BotView, now: number, safety: number, options: MatchOptions): Set<string> {
	const danger = new Set<string>();
	if (now < me.enchantedUntil)
		return danger; // enchanted: the sharks do not hurt
	const frozenUntil = Math.max(view.at, view.monstersFrozenUntil);
	const steps = Math.floor(Math.max(0, now - frozenUntil) / MONSTER_INTERVAL_MS[options.sharks]);
	// frozen right now: only the cell of each shark (touching a frozen shark still kills)
	const radius = now < view.monstersFrozenUntil ? 0 : safety + steps;
	for (const shark of view.monsters)
		for (const [key, d] of distances(state.walls, shark))
			if (d <= radius)
				danger.add(key);
	danger.delete(posKey(state.exit));
	return danger;
}

// Where to go: the turtle with all the diamonds, else a close power-up, else the best diamond (closest by the path, avoiding danger and rivals)
export function chooseTarget(state: GameState, me: Player, view: BotView, reach: Map<string, number>, danger: Set<string>): Position | null {
	if (me.diamonds >= state.goal)
		return state.exit;

	// the other fish that still compete for diamonds, and how far each one is from every cell
	const rivals = view.others
		.filter((o) => o.onMap && o.diamonds < state.goal)
		.map((o) => distances(state.walls, o.pos));

	let best: Position | null = null;
	let bestScore = Infinity;
	for (const diamond of view.diamonds) {
		const mine = reach.get(posKey(diamond));
		if (mine === undefined)
			continue; // it can not get there
		let score = mine;
		if (danger.has(posKey(diamond)))
			score += 6;
		if (rivals.some((dist) => (dist.get(posKey(diamond)) ?? Infinity) < mine))
			score += 4;
		if (score < bestScore) {
			best = diamond;
			bestScore = score;
		}
	}

	if (me.powerUp === null)
		for (const powerUp of view.powerUps) {
			const steps = reach.get(posKey(powerUp.pos));
			if (steps !== undefined && !danger.has(posKey(powerUp.pos)) && steps <= bestScore + BOT_POWERUP_DETOUR) {
				best = powerUp.pos;
				bestScore = steps;
			}
		}
	return best;
}

// Should it use the power-up it holds now? EASY uses it at once, the others wait for a good moment
export function wantsPowerUp(
	state: GameState, me: Player, view: BotView, now: number, params: BotParams,
	safePath: Direction[] | null, riskyPath: Direction[] | null, danger: Set<string>,
): boolean {
	if (me.powerUp === null)
		return false;
	if (!params.tactics)
		return true;
	switch (me.powerUp) {
		case "speed":
			// a long way, or the last run to the turtle
			return now >= me.speedUntil && safePath !== null
				&& (safePath.length >= 8 || (me.diamonds >= state.goal && safePath.length >= 3));
		case "freeze": {
			// someone is about to win, or a shark is touching it
			const toExit = distances(state.walls, state.exit);
			const rivalLeaving = view.others.some((o) => o.onMap && o.diamonds >= state.goal
				&& (toExit.get(posKey(o.pos)) ?? Infinity) <= 6);
			const sharkNext = now >= view.monstersFrozenUntil && view.monsters.some((m) => manhattan(m, me.pos) === 1);
			return rivalLeaving || sharkNext;
		}
		case "enchant": {
			// the safe way is much longer than the way between the sharks, or there is no safe way, or it is cornered
			if (now < me.enchantedUntil)
				return false;
			const longWay = riskyPath !== null && (safePath === null || safePath.length > riskyPath.length + 6);
			const cornered = danger.has(posKey(me.pos))
				&& DIRECTIONS.every((dir) => isWall(state.walls, step(me.pos, dir)) || danger.has(posKey(step(me.pos, dir))));
			return longWay || cornered;
		}
	}
}

// One key of the bot: looks again if it is time, picks the target and the path, and returns the step and the power-up
export function decide(
	state: GameState, slot: number, now: number, memory: BotMemory,
	params: BotParams, options: MatchOptions, random: () => number,
): BotAction {
	const none: BotAction = { dir: null, usePowerUp: false };
	const me = state.players[slot];
	if (state.status !== "running" || !me || me.status !== "playing") {
		memory.view = null; // dead (or not playing): it looks again as soon as it is back
		return none;
	}
	if (now < me.frozenUntil)
		return none; // frozen: the GameRoom would ignore it anyway

	if (memory.view === null || now - memory.view.at >= params.lookMs)
		memory.view = look(state, slot, now);
	const view = memory.view;

	// the last seconds and losing: a bit less careful
	const leader = Math.max(0, ...view.others.map((o) => o.diamonds));
	const hurry = state.endsAt - now <= BOT_HURRY_MS && me.diamonds < leader;
	const safety = hurry ? Math.max(0, params.safety - 1) : params.safety;

	const danger = dangerCells(state, me, view, now, safety, options);
	const fishAt = new Set(view.others.filter((o) => o.onMap).map((o) => posKey(o.pos)));
	const blockedSafe: Blocked = (p) => danger.has(posKey(p)) || fishAt.has(posKey(p));
	const blockedRisky: Blocked = (p) => fishAt.has(posKey(p));

	// the target: the old one (hesitation) or a new one
	const reach = distances(state.walls, me.pos, blockedSafe);
	let fresh = chooseTarget(state, me, view, reach, danger);
	// everything is behind a shark: it still picks a target, and then waits for the shark to pass (or uses an enchant)
	if (fresh === null)
		fresh = chooseTarget(state, me, view, distances(state.walls, me.pos, blockedRisky), danger);
	const oldStillThere = memory.target !== null && me.diamonds < state.goal
		&& [...view.diamonds, ...view.powerUps.map((p) => p.pos)].some((p) => samePos(p, memory.target!));
	if (!(oldStillThere && random() < params.stubborn))
		memory.target = fresh;
	const target = memory.target;

	const safePath = target ? findPath(state.walls, me.pos, target, blockedSafe) : null;
	const riskyPath = target ? findPath(state.walls, me.pos, target, blockedRisky) : null;
	const usePowerUp = wantsPowerUp(state, me, view, now, params, safePath, riskyPath, danger);

	let dir: Direction | null = safePath?.[0] ?? null;
	// no safe way: wait for the shark to pass, unless the shark is coming to this very cell: then step away
	if (safePath === null && danger.has(posKey(me.pos)))
		dir = DIRECTIONS.find((d) => !isWall(state.walls, step(me.pos, d)) && !blockedSafe(step(me.pos, d))) ?? null;

	// a human mistake: a random step, never into a wall or onto a shark it saw (bad, but not absurd)
	if (random() < params.mistake) {
		const possible = DIRECTIONS.filter((d) => {
			const to = step(me.pos, d);
			return !isWall(state.walls, to) && !view.monsters.some((m) => samePos(m, to));
		});
		if (possible.length > 0)
			dir = possible[Math.floor(random() * possible.length)];
	}
	return { dir, usePowerUp };
}
