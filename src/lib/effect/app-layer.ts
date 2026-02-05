import * as Layer from "effect/Layer";
import { DrizzleLive } from "./services/drizzle";
import { LoggerLive } from "./services/logger";
import { PgBossLive } from "./services/pg-boss";
import { PgBossWorkersLive } from "./services/pg-boss-workers";
import { SpiceDbLive } from "./services/spice";
import { TracerLive } from "./services/tracer";

// Provide PgBossLive to PgBossWorkersLive and merge their outputs.
const PgBossLayer = Layer.provideMerge(PgBossWorkersLive, PgBossLive);

// Compose all app-level services in one place.
export const AppLayer = Layer.mergeAll(
	TracerLive,
	LoggerLive,
	PgBossLayer,
	DrizzleLive,
	SpiceDbLive,
);
