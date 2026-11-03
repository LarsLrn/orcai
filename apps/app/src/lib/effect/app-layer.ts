import { AiTelemetryLive, EncryptionKeyLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import { makePgBossLayer } from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import { S3Live } from "@orcai/s3/server";
import { SpiceDbLive } from "@orcai/spice-db";
import { ValkeyLive } from "@orcai/valkey";
import * as Layer from "effect/Layer";
import { ProceduresLive } from "@/lib/orpc/implementation/procedures";
import { AuthzLive } from "./services/authz";
import { AppConfigLive } from "./services/config";
import { ObservabilityLive } from "./services/observability";

const BaseInfra = Layer.mergeAll(
	DrizzleLive,
	SpiceDbLive,
	S3Live,
	ValkeyLive,
	QdrantLive,
	EncryptionKeyLive,
).pipe(Layer.provideMerge(AppConfigLive));

const AppInfra = AuthzLive.pipe(Layer.provideMerge(BaseInfra));

/** Every app-level service but pg-boss, which the app or a test provides. */
export const AppServices = Layer.mergeAll(
	ObservabilityLive,
	AiTelemetryLive,
	ProceduresLive,
	AppInfra,
);

export const AppLayer = AppServices.pipe(
	Layer.provideMerge(
		makePgBossLayer({
			instanceName: "app",
		}),
	),
);
