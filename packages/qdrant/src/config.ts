import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const embeddingDimensionsConfig = Config.string("EMBEDDING_DIMENSIONS").pipe(
	Config.mapAttempt((value) => {
		const dimensions = Number.parseInt(value, 10);

		if (!Number.isInteger(dimensions) || dimensions <= 0) {
			throw new Error(
				`Invalid EMBEDDING_DIMENSIONS value "${value}". Expected a positive integer.`,
			);
		}

		return dimensions;
	}),
);

const qdrantConfig = Config.all({
	qdrant: Config.all({
		url: Config.string("QDRANT_URL"),
		apiKey: Config.redacted("QDRANT_API_KEY"),
		enableSparseVectors: Config.withDefault(
			Config.boolean("QDRANT_ENABLE_SPARSE_VECTORS"),
			false,
		),
	}),
	embedding: Config.all({
		dimensions: embeddingDimensionsConfig,
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
