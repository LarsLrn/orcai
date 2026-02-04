import { drizzle } from "drizzle-orm/node-postgres";
import { pgConnectionString } from "@/settings/db";
import { relations } from "./schema/relations";

export const db = drizzle(pgConnectionString, { relations });
