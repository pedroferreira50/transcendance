import { describe, expect, test } from "vitest";
import { parseMap, pickMap } from "../mapLoader";

const SMALL = [
    "11111",
    "1Aa*1",
    "10X01",
    "1bBE1",
    "11111",
].join("\n");

describe("parseMap", () => {
    test("reads every kind of tile", () => {
        const map = parseMap(SMALL);
        expect(map.width).toBe(5);
        expect(map.height).toBe(5);
        expect(map.walls[0][0]).toBe(true);
        expect(map.walls[1][1]).toBe(false); // spawns, coins... are floor
        expect(map.exit).toEqual({ x: 3, y: 3 });
        expect(map.spawns).toEqual([{ x: 1, y: 1 }, { x: 2, y: 3 }]);
        expect(map.coins).toEqual([
            { owner: 0, pos: { x: 2, y: 1 } },
            { owner: 1, pos: { x: 1, y: 3 } },
        ]);
        expect(map.monsters).toEqual([{ x: 2, y: 2 }]);
        expect(map.freezeSpots).toEqual([{ x: 3, y: 1 }]);
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
});

describe("pickMap", () => {
    test("keeps a valid choice", () => {
        expect(pickMap(3, "medium-2", () => 0)).toBe("medium-2");
    });

    test("random uses the random function", () => {
        expect(pickMap(2, "random", () => 0)).toBe("small-1");
        expect(pickMap(2, "random", () => 0.99)).toBe("small-2");
    });

    test("rejects a map of the wrong size", () => {
        expect(() => pickMap(2, "large-1", () => 0)).toThrow();
    });
});
