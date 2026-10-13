import { describe, expect, test } from "vitest";
import { loadMap, MAPS_BY_SIZE, type PlayerCount } from "../mapLoader";

// The minimum "validation" of our 6 hand-made maps.
for (const size of [2, 3, 4] as PlayerCount[]) {
    for (const name of MAPS_BY_SIZE[size]) {
        describe(name, () => {
            const map = loadMap(name);

            test("is closed by walls", () => {
                for (let x = 0; x < map.width; x++)
                    expect(map.walls[0][x] && map.walls[map.height - 1][x]).toBe(true);
                for (let y = 0; y < map.height; y++)
                    expect(map.walls[y][0] && map.walls[y][map.width - 1]).toBe(true);
            });

            test(`has exactly ${size} players`, () => {
                expect(map.spawns).toHaveLength(size);
            });

            test("every player has coins and there are no coins of missing players", () => {
                for (let slot = 0; slot < size; slot++)
                    expect(map.coins.some((c) => c.owner === slot)).toBe(true);
                expect(map.coins.every((c) => c.owner < size)).toBe(true);
            });

            test("has at least one freeze spot", () => {
                expect(map.freezeSpots.length).toBeGreaterThan(0);
            });
        });
    }
}
