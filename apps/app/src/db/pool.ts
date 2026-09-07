import { loadDbConfigSync, makePgConnectionString } from "@orcai/db";
import * as Redacted from "effect/Redacted";
import { Pool } from "pg";

const cfg = loadDbConfigSync();
const pgConnectionString = makePgConnectionString(cfg.postgres);

export const pgPool = new Pool({
	connectionString: Redacted.value(pgConnectionString),
});

// pg removes failed idle clients. Handle the event to avoid an uncaught error.
pgPool.on("error", (error) => {
	console.warn(`[db] idle client error: ${error.message}`);
});
