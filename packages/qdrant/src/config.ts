import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const qdrantConfig = Config.all({
	qdrant: Config.all({
		url: Config.string("QDRANT_URL"),
		apiKey: Config.redacted("QDRANT_API_KEY"),
		enableSparseVectors: Config.withDefault(
			Config.boolean("QDRANT_ENABLE_SPARSE_VECTORS"),
			false,
		),
	}),
});

export type QdrantConfig = Config.Config.Success<typeof qdrantConfig>;

export class QdrantConfigService extends Context.Tag("QdrantConfigService")<
	QdrantConfigService,
	{
		readonly config: QdrantConfig;
	}
>() {}

export const QdrantConfigLive = Layer.effect(
	QdrantConfigService,
	qdrantConfig.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);
