import { describe, expect, test } from "vitest";
import { mapsFor, mapSize, parseMap, pickMap } from "../mapLoader";

const SMALL = [
    "11111",
    "1A001",
    "11E11",
    "100B1",
    "11111",
].join("\n");

describe("parseMap", () => {
    test("reads walls, the exit and the spawns", () => {
        const map = parseMap(SMALL);
        expect(map.width).toBe(5);
        expect(map.height).toBe(5);
        expect(map.walls[0][0]).toBe(true);
        expect(map.walls[1][1]).toBe(false);   // spawns and the exit are floor
        expect(map.walls[2][2]).toBe(false);
        expect(map.exit).toEqual({ x: 2, y: 2 });
        expect(map.spawns).toEqual([{ x: 1, y: 1 }, { x: 3, y: 3 }]);
    });

    test("accepts Windows line endings and a trailing newline", () => {
        expect(parseMap(SMALL.replace(/\n/g, "\r\n") + "\r\n")).toEqual(parseMap(SMALL));
    });

    test("rejects broken maps", () => {
        expect(() => parseMap("")).toThrow("empty");
        expect(() => parseMap("111\n1A0E1\n111")).toThrow("columns");
        expect(() => parseMap("11111\n1APE1\n11111")).toThrow("unknown");
        expect(() => parseMap("11111\n1A001\n11111")).toThrow("no exit");
        expect(() => parseMap("11111\n1AEE1\n11111")).toThrow("more than one exit");
        expect(() => parseMap("11111\n1AAE1\n11111")).toThrow("more than once");
        expect(() => parseMap("11111\n1BE01\n11111")).toThrow("spawn A is missing");
    });

    test("rejects the characters of the old format", () => {
        for (const ch of ["a", "c", "X", "*"])
            expect(() => parseMap(`11111\n1A${ch}E1\n11111`)).toThrow("unknown");
    });
});

describe("mapsFor", () => {
    test("2 players can play on every map", () => {
        expect(mapsFor(2)).toEqual(["small-1", "small-2", "medium-1", "medium-2", "large-1", "large-2"]);
    });

    test("3 players: medium and large maps", () => {
        expect(mapsFor(3)).toEqual(["medium-1", "medium-2", "large-1", "large-2"]);
    });

    test("4 players: only large maps", () => {
        expect(mapsFor(4)).toEqual(["large-1", "large-2"]);
    });
});

describe("mapSize", () => {
    test("knows the size of each map", () => {
        expect(mapSize("small-2")).toBe("small");
        expect(mapSize("large-1")).toBe("large");
        expect(() => mapSize("huge-1")).toThrow("unknown");
    });
});

describe("pickMap", () => {
    test("keeps a valid choice", () => {
        expect(pickMap(2, "large-2", () => 0)).toBe("large-2");
        expect(pickMap(3, "medium-1", () => 0)).toBe("medium-1");
    });

    test("random picks among the maps for that number of players", () => {
        expect(pickMap(3, "random", () => 0)).toBe("medium-1");
        expect(pickMap(3, "random", () => 0.99)).toBe("large-2");
        expect(pickMap(4, "random", () => 0)).toBe("large-1");
    });

    test("rejects a map that does not accept that number of players", () => {
        expect(() => pickMap(3, "small-1", () => 0)).toThrow("not for 3 players");
        expect(() => pickMap(4, "medium-1", () => 0)).toThrow("not for 4 players");
        expect(() => pickMap(2, "../../.env", () => 0)).toThrow();
    });
});
