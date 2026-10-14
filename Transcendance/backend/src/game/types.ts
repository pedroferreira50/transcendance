// Shared types of the game engine

export type Position = { 
	x: number; 
	y: number 
};
export type Direction = "up" | "down" | "left" | "right";

export type MapSize = "small" | "medium" | "large";
export type Character = "goldfish" | "betta" | "angler" | "puffer";
export type PowerUpType = "speed" | "freeze" | "enchant";

// What a .ber file turns into after parseMap()
export type MapData = {
	width: number;
	height: number;
	walls: boolean[][]; // [y][x], true = wall
	exit: Position; // the turtle
	spawns: Position[]; // index = slot (A=0, B=1, C=2, D=3)
};

export type PlayerStatus = "playing" | "dead" | "disconnected" | "left" | "finished";

export type Player = {
	userId: number | null; // null = guest (local mode)
	username: string;
	slot: number; // 0..3 -> A..D
	character: Character;
	pos: Position;
	spawn: Position;
	diamonds: number; // collected (stops at the goal)
	moves: number;
	deaths: number;
	facing: "left" | "right";
	status: PlayerStatus;
	lastMoveAt: number;
	respawnAt: number;
	invulnerableUntil: number;
	frozenUntil: number;
	speedUntil: number;
	enchantedUntil: number;
	powerUp: PowerUpType | null; // the one being held
	disconnectedAt: number | null;
};

export type PowerUp = { 
	type: PowerUpType; 
	pos: Position 
};

export type GameState = {
	id: string;
	mapName: string;
	width: number;
	height: number;
	walls: boolean[][]; // fixed part, [y][x]
	exit: Position;
	goal: number; // diamonds needed to leave (5 or 10)
	players: Player[];
	monsters: Position[];
	monstersFrozenUntil: number;
	diamonds: Position[]; // the ones still on the map
	powerUps: PowerUp[];
	nextPowerUpAt: number;
	endsAt: number;
	status: "countdown" | "running" | "finished";
	winnerSlot: number | null;
	local: boolean; // local 1v1 match
};
