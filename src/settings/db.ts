import { loadAppConfigSync } from "@/lib/effect/services/config";

const cfg = loadAppConfigSync();

export const pgConnectionString = `postgres://${cfg.postgres.user}:${cfg.postgres.password}@${cfg.postgres.host}:${cfg.postgres.port || "5432"}/${cfg.postgres.db}`;
