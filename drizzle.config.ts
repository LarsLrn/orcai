import { defineConfig } from "drizzle-kit";
import { serverEnv } from "@/lib/env/server";

export default defineConfig({
	schema: "./src/db/schema",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: `postgres://${serverEnv.POSTGRES_USER}:${serverEnv.POSTGRES_PASSWORD}@${serverEnv.POSTGRES_HOST}:${serverEnv.POSTGRES_PORT}/${serverEnv.POSTGRES_DB}`,
	},
});
