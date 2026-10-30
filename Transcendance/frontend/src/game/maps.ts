// The maps of the game and how many players each one accepts.
// COPY of MAPS and SIZE_RULES of backend/src/game: if you change one, change the other
// (backend/src/game/__tests__/protocol.test.ts fails if they are different)

export type PlayerCount = 2 | 3 | 4;

export const MAPS: { name: string; players: PlayerCount[] }[] = [
	{ name: "small-1", players: [2] },
	{ name: "small-2", players: [2] },
	{ name: "medium-1", players: [2, 3] },
	{ name: "medium-2", players: [2, 3] },
	{ name: "large-1", players: [2, 3, 4] },
	{ name: "large-2", players: [2, 3, 4] },
];

// The maps where that number of players fits
export function mapsFor(players: PlayerCount): string[] {
	return MAPS.filter((map) => map.players.includes(players)).map((map) => map.name);
}

// "medium-1" -> "MEDIUM 1"
export function mapLabel(name: string): string {
	return name.replace("-", " ").toUpperCase();
}
