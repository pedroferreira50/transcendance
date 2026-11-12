import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DATABASE_URL =
    process.env.DATABASE_URL ?? "file:./users.db";

const databaseUrl = new URL(
    DATABASE_URL,
    pathToFileURL(resolve(process.cwd()) + sep),
);

if (databaseUrl.protocol !== "file:") {
    throw new Error('DATABASE_URL must use the "file:" protocol.');
}

export const DATABASE_PATH = fileURLToPath(databaseUrl);