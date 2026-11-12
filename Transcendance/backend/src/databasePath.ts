import { fileURLToPath } from "node:url";

// DATABASE_URL may be a plain path (local development) or a file: URL (Docker).
export function resolveDatabasePath(value: string): string {
    if (value === ":memory:")
        return value;

    if (!value.startsWith("file:"))
        return value;

    const rest = value.slice("file:".length);

    // file:users.db / file:./users.db are relative paths, not absolute file URLs
    if (!rest.startsWith("/") && !rest.startsWith("//"))
        return rest;

    return fileURLToPath(new URL(value));
}
