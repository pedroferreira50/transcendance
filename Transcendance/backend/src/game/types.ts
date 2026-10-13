// Shared types of the game engine

export type Position = { 
	x: number; 
	y: number 
};
export type Direction = "up" | "down" | "left" | "right";

export type Coin = { 
	owner: number; // owner = player slot (0..3)
	pos: Position 
};

// What a .ber file turns into after parseMap()
export type MapData = {
	width: number;
	height: number;
	walls: boolean[][]; // [y][x], true = wall
	exit: Position;
	spawns: Position[]; // index = slot (A=0, B=1, C=2, D=3)
	coins: Coin[];
	monsters: Position[];
	freezeSpots: Position[]; // where the freeze item may appear
};

export type PlayerStatus = "playing" | "dead" | "disconnected" | "left" | "finished";

export type Player = {
	userId: number | null; // null = guest (local mode)
	username: string;
	slot: number; // 0..3 -> A..D
	pos: Position;
	spawn: Position;
	coinsLeft: number;
	moves: number;
	deaths: number;
	facing: "left" | "right";
	status: PlayerStatus;
	lastMoveAt: number;
	respawnAt: number;
	invulnerableUntil: number;
	frozenUntil: number;
	hasFreeze: boolean;
	disconnectedAt: number | null;
};

export type GameState = {
	id: string;
	mapName: string;
	width: number;
	height: number;
	walls: boolean[][]; // fixed part, [y][x]
	exit: Position;
	players: Player[];
	monsters: Position[];
	coins: Coin[];
	freezeSpots: Position[];
	freezeItem: Position | null; // freeze item on the floor (max 1)
	endsAt: number;
	status: "countdown" | "running" | "finished";
	winnerSlot: number | null;
	local: boolean; // local 1v1 match
};
