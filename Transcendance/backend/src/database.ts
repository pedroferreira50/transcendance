import Database from "better-sqlite3";

const db = new Database("users.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        multiplayer_wins INTEGER NOT NULL DEFAULT 0,
        multiplayer_losses INTEGER NOT NULL DEFAULT 0
    )
`);

const columns = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
const columnNames = columns.map((column) => column.name);

if (!columnNames.includes("wins")) {
    db.exec(`ALTER TABLE users ADD COLUMN wins INTEGER NOT NULL DEFAULT 0`);
}

if (!columnNames.includes("losses")) {
    db.exec(`ALTER TABLE users ADD COLUMN losses INTEGER NOT NULL DEFAULT 0`);
}

if (!columnNames.includes("multiplayer_wins")) {
    db.exec(`ALTER TABLE users ADD COLUMN multiplayer_wins INTEGER NOT NULL DEFAULT 0`);
}

if (!columnNames.includes("multiplayer_losses")) {
    db.exec(`ALTER TABLE users ADD COLUMN multiplayer_losses INTEGER NOT NULL DEFAULT 0`);
}

export default db;