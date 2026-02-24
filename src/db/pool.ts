import * as Redacted from "effect/Redacted";
import { Pool } from "pg";
import { makePgConnectionString } from "@/db/pg-connection-string";
import { loadAppConfigSync } from "@/lib/effect/services/config";

const cfg = loadAppConfigSync();
const pgConnectionString = makePgConnectionString(cfg.postgres);

export const pgPool = new Pool({
	connectionString: Redacted.value(pgConnectionString),
});
