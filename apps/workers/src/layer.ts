import { AiConfigLive, AiTelemetryLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import { EmailConfigLive, EmailLive } from "@orcai/notifications";
import { PgBossLive } from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import { S3Live } from "@orcai/s3/server";
import * as Layer from "effect/Layer";
import { ObservabilityLive } from "./observability";

export const BackgroundWorkerLayer = Layer.mergeAll(
	ObservabilityLive,
	AiTelemetryLive,
	DrizzleLive,
	PgBossLive,
	S3Live,
	QdrantLive,
	AiConfigLive,
	EmailLive.pipe(Layer.provide(EmailConfigLive)),
);
