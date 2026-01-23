import { drizzle } from "drizzle-orm/node-postgres";
import { pgConnectionString } from "@/settings/db";

export const db = drizzle(pgConnectionString);
