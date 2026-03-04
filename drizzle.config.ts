import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB}`,
	},
	schemaFilter: [
		"public",
	],
});
