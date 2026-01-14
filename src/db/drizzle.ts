import { drizzle } from "drizzle-orm/node-postgres";
import { serverEnv } from "@/lib/env/server";

export const db = drizzle(
	`postgres://${serverEnv.POSTGRES_USER}:${serverEnv.POSTGRES_PASSWORD}@${serverEnv.POSTGRES_HOST}:${serverEnv.POSTGRES_PORT}/${serverEnv.POSTGRES_DB}`,
);
