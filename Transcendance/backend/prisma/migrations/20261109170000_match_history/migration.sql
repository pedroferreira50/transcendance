-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "map_name" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME NOT NULL,
    "end_reason" TEXT NOT NULL,
    "winner_id" INTEGER,
    CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "match_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "character" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "diamonds" INTEGER NOT NULL,
    "moves" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "power_ups_used" INTEGER NOT NULL,
    "finish_ms" INTEGER,
    CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "matches_ended_at_idx" ON "matches"("ended_at");

-- CreateIndex
CREATE INDEX "matches_winner_id_idx" ON "matches"("winner_id");

-- CreateIndex
CREATE INDEX "match_players_user_id_match_id_idx" ON "match_players"("user_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_match_id_slot_key" ON "match_players"("match_id", "slot");
