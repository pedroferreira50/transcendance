// What the server sends to the browser during a match.
// COPY of the same types in backend/src/game/types.ts: if you change one, change the other
// (backend/src/game/__tests__/protocol.test.ts fails if they are different)

export type Position = {
	x: number;
	y: number;
};
export type Direction = "up" | "down" | "left" | "right";

export type Character = "goldfish" | "betta" | "angler" | "puffer";
export type PowerUpType = "speed" | "freeze" | "enchant";
export type PlayerStatus = "playing" | "dead" | "disconnected" | "left" | "finished";

export type PowerUp = {
	type: PowerUpType;
	pos: Position;
};

export type EndReason = "exit" | "timeout" | "forfeit";

export type GameEvent =
	| { type: "diamond"; slot: number; pos: Position }
	| { type: "powerUpPickup"; slot: number; powerUp: PowerUpType }
	| { type: "powerUpUsed"; slot: number; powerUp: PowerUpType }
	| { type: "death"; slot: number; pos: Position };

// Times = ms left, 0 = off
export type PlayerView = {
	slot: number;
	username: string;
	character: Character;
	pos: Position;
	diamonds: number;
	moves: number;
	deaths: number;
	facing: "left" | "right";
	status: PlayerStatus;
	powerUp: PowerUpType | null;
	respawnMs: number;
	invulnerableMs: number;
	frozenMs: number;
	speedMs: number;
	enchantedMs: number;
};

// Each game:state
export type DynamicState = {
	status: "countdown" | "running" | "finished";
	timeLeftMs: number;
	goal: number;
	players: PlayerView[];
	monsters: Position[];
	monstersFrozenMs: number;
	diamonds: Position[];
	powerUps: PowerUp[];
	winnerSlot: number | null;
	endReason: EndReason | null;
};

// game:start, only once
export type MapInfo = {
	name: string;
	width: number;
	height: number;
	walls: boolean[][]; // [y][x], true = wall
	exit: Position;
};
