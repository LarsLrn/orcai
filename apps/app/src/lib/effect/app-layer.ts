import { AiConfigLive, DoclingLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import { PgBossLive } from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import { QuotaCounterStoreLive } from "@orcai/quota";
import { S3Live } from "@orcai/s3/server";
import { SpiceDbLive } from "@orcai/spice-db";
import { ValkeyLive } from "@orcai/valkey";
import * as Layer from "effect/Layer";
import { AuthzLive } from "./services/authz";
import { AppConfigLive } from "./services/config";
import { EmailLive } from "./services/email";
import { LoggerLive } from "./services/logger";
import { TracerLive } from "./services/tracer";

const BaseInfra = Layer.mergeAll(
	DrizzleLive,
	SpiceDbLive,
	S3Live,
	PgBossLive,
	ValkeyLive,
	QdrantLive,
	DoclingLive,
	EmailLive,
).pipe(Layer.provideMerge(AiConfigLive), Layer.provideMerge(AppConfigLive));

const AppInfra = Layer.mergeAll(AuthzLive, QuotaCounterStoreLive).pipe(
	Layer.provideMerge(BaseInfra),
);

// Compose all app-level services in one place.
export const AppLayer = Layer.mergeAll(TracerLive, LoggerLive, AppInfra);
