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
import { ObservabilityLive } from "./services/observability";

const BaseInfra = Layer.mergeAll(
	DrizzleLive,
	SpiceDbLive,
	S3Live,
	PgBossLive,
	ValkeyLive,
	QdrantLive,
	EmailLive,
).pipe(Layer.provideMerge(AppConfigLive));

const AppInfra = Layer.mergeAll(AuthzLive, QuotaCounterStoreLive).pipe(
	Layer.provideMerge(BaseInfra),
);

// Compose all app-level services in one place.
export const AppLayer = Layer.mergeAll(ObservabilityLive, AppInfra);
