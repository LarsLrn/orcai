import * as Layer from "effect/Layer";
import { QdrantLive } from "@/lib/effect/services/qdrant";
import { AuthzLive } from "./services/authz";
import { AppConfigLive } from "./services/config";
import { DoclingLive } from "./services/docling";
import { DrizzleLive } from "./services/drizzle";
import { EmailLive } from "./services/email";
import { LoggerLive } from "./services/logger";
import { PgBossLive } from "./services/pg-boss";
import { PgBossWorkersLive } from "./services/pg-boss-workers";
import { S3Live } from "./services/s3";
import { SpiceDbLive } from "./services/spice";
import { TracerLive } from "./services/tracer";
import { ValkeyLive } from "./services/valkey";

// Provide PgBossLive to PgBossWorkersLive and merge their outputs.
const BaseInfra = Layer.mergeAll(
	DrizzleLive,
	SpiceDbLive,
	S3Live,
	PgBossLive,
	ValkeyLive,
	QdrantLive,
	DoclingLive,
	EmailLive,
).pipe(Layer.provideMerge(AppConfigLive));

const AppInfra = PgBossWorkersLive.pipe(
	Layer.provideMerge(AuthzLive),
	Layer.provideMerge(BaseInfra),
);

// Compose all app-level services in one place.
export const AppLayer = Layer.mergeAll(TracerLive, LoggerLive, AppInfra);
