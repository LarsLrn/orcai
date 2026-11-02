import { QdrantClient } from "@qdrant/qdrant-js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	defaultBm25Config,
	QdrantConfigLive,
	QdrantConfigService,
} from "./config";

/** The Qdrant client; collections come from the active embedding generation. */
export class QdrantService extends Context.Service<
	QdrantService,
	{
		readonly client: QdrantClient;
		readonly bm25Config: typeof defaultBm25Config;
	}
>()("QdrantService") {}

export const QdrantServiceLive = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const { config } = yield* QdrantConfigService;

		return {
			client: new QdrantClient({
				url: config.qdrant.url,
				port: null,
				apiKey: Redacted.value(config.qdrant.apiKey),
			}),
			bm25Config: defaultBm25Config,
		};
	}),
);

export const QdrantLive = QdrantServiceLive.pipe(
	Layer.provide(QdrantConfigLive),
);
