import { drizzle } from "drizzle-orm/node-postgres";
import { pgPool } from "@/db/pool";
import { relations } from "@/db/schema/relations";

export const authDb = drizzle({ client: pgPool, relations });
