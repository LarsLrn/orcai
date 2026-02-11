import * as Layer from "effect/Layer";
import { AppConfigLive } from "./services/config";
import { DrizzleLive } from "./services/drizzle";
import { LoggerLive } from "./services/logger";
import { PgBossLive } from "./services/pg-boss";
import { PgBossWorkersLive } from "./services/pg-boss-workers";
import { SpiceDbLive } from "./services/spice";
import { TracerLive } from "./services/tracer";

// Provide PgBossLive to PgBossWorkersLive and merge their outputs.
const BaseInfra = Layer.mergeAll(DrizzleLive, SpiceDbLive, PgBossLive).pipe(
	Layer.provide(AppConfigLive),
);

const InfraWithWorkers = Layer.provideMerge(PgBossWorkersLive, BaseInfra);

// Compose all app-level services in one place.
export const AppLayer = Layer.mergeAll(
	TracerLive,
	LoggerLive,
	InfraWithWorkers,
);
