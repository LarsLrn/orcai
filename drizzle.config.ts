import { defineConfig } from "drizzle-kit";
import { pgConnectionString } from "@/settings/db";

export default defineConfig({
	schema: "./src/db/schema",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: pgConnectionString,
	},
});
