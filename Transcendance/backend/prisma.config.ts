import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: "file:./users.db",
		shadowDatabaseUrl: "file:./prisma-shadow.db",
	},
});
