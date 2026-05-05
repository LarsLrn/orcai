import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

const embeddingDimensionsConfig = Config.schema(
	Schema.Int.check(
		Schema.isGreaterThan(0, {
			message: "Expected a positive integer",
		}),
	),
	"EMBEDDING_DIMENSIONS",
);

export const defaultBm25Config = {
	language: "none",
	tokenizer: "multilingual",
	asciiFolding: true,
} as const;

const qdrantConfig = Config.all({
	qdrant: Config.all({
		url: Config.string("QDRANT_URL"),
		apiKey: Config.redacted("QDRANT_API_KEY"),
	}),
	embedding: Config.all({
		dimensions: embeddingDimensionsConfig,
	}),
});

export type QdrantConfig = Config.Success<typeof qdrantConfig>;

export class QdrantConfigService extends Context.Service<
	QdrantConfigService,
	{
		readonly config: QdrantConfig;
	}
>()("QdrantConfigService") {}

export const QdrantConfigLive = Layer.effect(
	QdrantConfigService,
	Effect.gen(function* () {
		const config = yield* qdrantConfig;

		return {
			config,
		};
	}),
);
