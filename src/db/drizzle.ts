import { drizzle } from "drizzle-orm/node-postgres";
import { pgPool } from "./pool";
import { relations } from "./schema/relations";

export const db = drizzle({ client: pgPool, relations });
