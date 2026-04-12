import { createOpenAI } from "@ai-sdk/openai";
import { type CallSettings, generateText, type Prompt } from "ai";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { AiConfigService } from "./config";
import { AiError } from "./errors";

export interface GenerateTextResult {
	readonly text: string;
	readonly usage: {
		readonly totalTokens?: number;
	};
}

const getProvider = Effect.gen(function* () {
	const { config } = yield* AiConfigService;

	return createOpenAI({
		baseURL: config.baseUrl,
		apiKey: Redacted.value(config.apiKey),
		name: "globalProvider",
	});
});

export const generateTextEffect = (params: CallSettings & Prompt) =>
	Effect.gen(function* () {
		const { config } = yield* AiConfigService;
		const provider = yield* getProvider;

		const response = yield* Effect.tryPromise({
			try: () =>
				generateText({
					model: provider(config.general.model),
					...params,
				}),
			catch: (cause) =>
				new AiError({
					operation: "generateText",
					cause,
				}),
		});

		return {
			text: response.text,
			usage: response.usage,
		};
	});
