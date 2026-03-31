import { loadDbConfigSync, makePgConnectionString } from "@orcai/db";
import * as Redacted from "effect/Redacted";
import { Pool } from "pg";

const cfg = loadDbConfigSync();
const pgConnectionString = makePgConnectionString(cfg.postgres);

export const pgPool = new Pool({
	connectionString: Redacted.value(pgConnectionString),
});
