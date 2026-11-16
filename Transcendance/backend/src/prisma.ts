import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { DATABASE_URL } from "./databaseConfig";

const adapter = new PrismaBetterSqlite3({
    url: DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;