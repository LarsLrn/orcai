import { AiConfigLive } from "@orcai/ai";
import { DrizzleLive } from "@orcai/db";
import { EmailConfigLive, EmailLive } from "@orcai/notifications";
import { PgBossLive } from "@orcai/pg-boss";
import { QdrantLive } from "@orcai/qdrant";
import { QuotaCounterStoreLive } from "@orcai/quota";
import { S3Live } from "@orcai/s3/server";
import { ValkeyLive } from "@orcai/valkey";
import * as Layer from "effect/Layer";
import { ObservabilityLive } from "./observability";

const BaseWorkerLayer = Layer.mergeAll(
	DrizzleLive,
	PgBossLive,
	ValkeyLive,
	S3Live,
	QdrantLive,
	AiConfigLive,
	EmailLive.pipe(Layer.provide(EmailConfigLive)),
);

export const BackgroundWorkerLayer = Layer.mergeAll(
	ObservabilityLive,
	BaseWorkerLayer,
	QuotaCounterStoreLive.pipe(Layer.provideMerge(BaseWorkerLayer)),
);
