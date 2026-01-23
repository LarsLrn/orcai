import { serverEnv } from "@/lib/env/server";

export const pgConnectionString = `postgres://${serverEnv.POSTGRES_USER}:${serverEnv.POSTGRES_PASSWORD}@${serverEnv.POSTGRES_HOST}:${serverEnv.POSTGRES_PORT || "5432"}/${serverEnv.POSTGRES_DB}`;
