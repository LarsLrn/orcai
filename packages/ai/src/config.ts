import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const aiConfig = Config.all({
	baseUrl: Config.string("OPENAI_COMPATIBLE_BASE_URL"),
	apiKey: Config.redacted("OPENAI_COMPATIBLE_API_KEY"),
	embedding: Config.all({
		model: Config.string("EMBEDDING_MODEL"),
	}),
	general: Config.all({
		model: Config.string("GENERAL_MODEL"),
	}),
});

export type AiConfig = Config.Success<typeof aiConfig>;

export class AiConfigService extends Context.Service<
	AiConfigService,
	{
		readonly config: AiConfig;
	}
>()("AiConfigService") {}

export const AiConfigLive = Layer.effect(
	AiConfigService,
	Effect.gen(function* () {
		const config = yield* aiConfig;

		return {
			config,
		};
	}),
);
