import { expect, test } from "vitest";
import { resolveDatabasePath } from "../databasePath";

test("a plain path is kept", () => {
	expect(resolveDatabasePath("users.db")).toBe("users.db");
});

test("an absolute file: URL becomes a filesystem path", () => {
	expect(resolveDatabasePath("file:/app/data/users.db")).toBe("/app/data/users.db");
});

test("an in-memory database is kept", () => {
	expect(resolveDatabasePath(":memory:")).toBe(":memory:");
});

test("a relative file: URL loses the scheme", () => {
	expect(resolveDatabasePath("file:users.db")).toBe("users.db");
});
