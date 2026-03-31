import { relations } from "@orcai/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgPool } from "@/db/pool";

export const authDb = drizzle({
	client: pgPool,
	relations,
});
