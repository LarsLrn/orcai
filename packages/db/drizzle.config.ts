/// <reference types="node" />

import { defineConfig } from "drizzle-kit";
import * as Redacted from "effect/Redacted";
import { makePgConnectionString } from "./src/pg-connection-string";

const env = process.env;

export default defineConfig({
	schema: "./src/schema",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		// Read without validation: `check` and `generate` run without a database.
		url: Redacted.value(
			makePgConnectionString({
				user: env.POSTGRES_USER ?? "",
				password: Redacted.make(env.POSTGRES_PASSWORD ?? ""),
				host: env.POSTGRES_HOST ?? "",
				port: Number(env.POSTGRES_PORT || 5432),
				db: env.POSTGRES_DB ?? "",
			}),
		),
	},
	schemaFilter: [
		"public",
	],
});
