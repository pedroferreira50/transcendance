// A fake match, created manually, to simulate the game before the server exists (Step 2)
import type { DynamicState, MapInfo } from "./protocol";

// small-1.ber (1 = wall, E = turtle; the spawns are floor)
const ROWS = [
	"1111111111111111111",
	"1A00000001000000001",
	"1011101100011011101",
	"1000000000000000001",
	"100101001E100101001",
	"1000001000001000001",
	"1011101100011011101",
	"10000000010000000B1",
	"1111111111111111111",
];

export const fixtureMap: MapInfo = {
	name: "small-1",
	width: ROWS[0].length,
	height: ROWS.length,
	walls: ROWS.map((row) => [...row].map((cell) => cell === "1")),
	exit: { x: 9, y: 4 },
};

export const fixtureState: DynamicState = {
	status: "running",
	timeLeftMs: 6_000,
	goal: 5,
	players: [
		{
			slot: 0,
			username: "luiz",
			character: "betta",
			pos: { x: 5, y: 3 },
			diamonds: 2,
			moves: 31,
			deaths: 2,
			facing: "right",
			status: "dead",
			powerUp: null, // holding a power-up
			respawnMs: 2000,
			invulnerableMs: 0,
			frozenMs: 0,
			speedMs: 3000, // trail behind
			enchantedMs: 4000, // hearts around
		},
		{
			slot: 1,
			username: "pedro",
			character: "puffer",
			pos: { x: 13, y: 5 },
			diamonds: 3,
			moves: 28,
			deaths: 0,
			facing: "left",
			status: "playing",
			powerUp: "speed",
			respawnMs: 0,
			invulnerableMs: 0, // blinking
			frozenMs: 0, // frozen
			speedMs: 1000,
			enchantedMs: 0,
		},
	],
	monsters: [{ x: 8, y: 1 }, { x: 16, y: 3 }, { x: 2, y: 5 }, { x: 12, y: 7 }],
	monstersFrozenMs: 0,
	diamonds: [{ x: 3, y: 1 }, { x: 9, y: 2 }, { x: 10, y: 3 }, { x: 1, y: 4 }, { x: 5, y: 5 }, { x: 15, y: 7 }],
	powerUps: [{ type: "speed", pos: { x: 13, y: 2 } }, { type: "enchant", pos: { x: 4, y: 7 } }],
	winnerSlot: null,
	endReason: null,
};
