import type { Schemas } from "@qdrant/qdrant-js";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** Qdrant's German stopwords with umlauts or ß. */
const GERMAN_ACCENTED_STOPWORDS = [
	"daß",
	"für",
	"können",
	"könnte",
	"über",
	"während",
	"würde",
	"würden",
];

const foldToAscii = (word: string) =>
	word.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ß", "ss");

export const defaultBm25Config = {
	tokenizer: "multilingual",
	ascii_folding: true,
	stemmer: {
		type: "none",
	},
	// Qdrant folds accents before it drops stopwords, so these only match folded.
	stopwords: {
		languages: [
			"german",
			"english",
		],
		custom: GERMAN_ACCENTED_STOPWORDS.map(foldToAscii),
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
