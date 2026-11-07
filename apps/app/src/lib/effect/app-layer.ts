import { AiTelemetryLive, EncryptionKeyLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import { makePgBossLayer } from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import { S3Live } from "@orcai/s3/server";
import { SpiceDbLive } from "@orcai/spice-db";
import * as Layer from "effect/Layer";
import { ProceduresLive } from "@/lib/orpc/implementation/procedures";
import { AuthzLive, AuthzReplayLive } from "./services/authz";
import { AppConfigLive } from "./services/config";
import { ObservabilityLive } from "./services/observability";

const BaseInfra = Layer.mergeAll(
	DrizzleLive,
	SpiceDbLive,
	S3Live,
	QdrantLive,
	EncryptionKeyLive,
).pipe(Layer.provideMerge(AppConfigLive));

const AppInfra = AuthzLive.pipe(Layer.provideMerge(BaseInfra));

/**
 * Every app-level service but pg-boss, which the app or a test provides, and
 * the outbox replay loop, which only the app runs.
 */
export const AppServices = Layer.mergeAll(
	ObservabilityLive,
	AiTelemetryLive,
	ProceduresLive,
	AppInfra,
);

/** The app's services with pg-boss and the outbox replay loop. */
export const AppLayer = AuthzReplayLive.pipe(
	Layer.provideMerge(AppServices),
	Layer.provideMerge(
		makePgBossLayer({
			instanceName: "app",
		}),
	),
);
