import type { Schemas } from "@qdrant/qdrant-js";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const defaultBm25Config = {
	tokenizer: "multilingual",
	ascii_folding: true,
	stemmer: {
		type: "none",
	},
	stopwords: {
		languages: [],
		custom: [],
	},
} satisfies Schemas["Bm25Config"];

const qdrantConfig = Config.all({
	url: Config.String("QDRANT_URL"),
	apiKey: Config.Redacted("QDRANT_API_KEY"),
});

type QdrantConfig = Config.Success<typeof qdrantConfig>;

export class QdrantConfigService extends Context.Service<
	QdrantConfigService,
	{
		readonly config: QdrantConfig;
	}
>()("QdrantConfigService") {}

export const QdrantConfigLive = Layer.effect(
	QdrantConfigService,
	Effect.map(qdrantConfig, (config) => ({
		config,
	})),
);
