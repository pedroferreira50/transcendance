// Shared types of the game engine

export type Position = { 
	x: number; 
	y: number 
};
export type Direction = "up" | "down" | "left" | "right";

export type MapSize = "small" | "medium" | "large";
export type Character = "goldfish" | "betta" | "angler" | "puffer";
export type PowerUpType = "speed" | "freeze" | "enchant";
export type MatchTime = "short" | "normal" | "long"; // relative to the time of the map size
export type SharkSpeed = "slow" | "normal" | "fast";
export type BotLevel = "easy" | "normal" | "hard";

// What the host (or the local player) chooses for the match: the same map, different rules
export type MatchOptions = {
	time: MatchTime;
	sharks: SharkSpeed;
	powerUps: PowerUpType[]; // the ones that can appear (empty = none)
};

// How a bot level plays (BOT_LEVELS in config.ts): the same brain, different numbers
export type BotParams = {
	lookMs: number; // how often it looks at the map again (its reaction time)
	stepMs: number; // how often it presses a key (the cooldown of the game allows 100 ms)
	mistake: number; // chance of a wrong step, 0..1
	safety: number; // how many cells it tries to keep between itself and a shark
	stubborn: number; // chance of keeping its old target when a better one shows up, 0..1
	tactics: boolean; // false: uses a power-up as soon as it has one; true: waits for the right moment
};

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
	powerUpsUsed: number;
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

export type EndReason = "exit" | "timeout" | "forfeit";

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
	startedAt: number | null;
	endedAt: number | null;
	status: "countdown" | "running" | "finished";
	winnerSlot: number | null;
	endReason: EndReason | null;
	local: boolean; // local 1v1 match
};

// Something that happened, for the client to show (sound, "+1", animation)
export type GameEvent =
	| { type: "diamond"; slot: number; pos: Position }
	| { type: "powerUpPickup"; slot: number; powerUp: PowerUpType }
	| { type: "powerUpUsed"; slot: number; powerUp: PowerUpType }
	| { type: "death"; slot: number; pos: Position };

// What the client sees of a player
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

// What goes in each game:state (the walls and the turtle go only once, at the start)
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

// What goes in game:start, only once (the fixed part of the map)
export type MapInfo = {
	name: string; // to find /maps/<name>.webp
	width: number;
	height: number;
	walls: boolean[][]; // [y][x], true = wall
	exit: Position;
};

// The bot of a match, for the screen: which fish it is and its level
export type BotInfo = {
	slot: number;
	level: BotLevel;
};

// game:start, sent once to each player, and game:resume, for a player who came back (F5, the internet returned, another tab)
export type GameStart = {
	gameId: string;
	map: MapInfo;
	you: number | null; // your slot (null = local match: you play both)
	state: DynamicState;
	countdown: number; // seconds before the match begins: the first game:countdown can arrive before the screen listens
	local: boolean; // local match: the screen sends the slot with each command
	bot: BotInfo | null; // PLAY vs BOT: the fish of the bot (null = only people play)
};
