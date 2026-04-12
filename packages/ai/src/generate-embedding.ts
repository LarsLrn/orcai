import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { AiConfigService } from "./config";
import { AiError } from "./errors";

const trimNewlines = (input: string) => input.replaceAll("\\n", " ");

const getProvider = Effect.gen(function* () {
	const { config } = yield* AiConfigService;

	return createOpenAI({
		baseURL: config.baseUrl,
		apiKey: Redacted.value(config.apiKey),
		name: "globalProvider",
	});
});

export const generateEmbedding = (params: { value: string }) =>
	Effect.gen(function* () {
		const { config } = yield* AiConfigService;
		const provider = yield* getProvider;

		const input = trimNewlines(params.value);
		return yield* Effect.tryPromise({
			try: () =>
				embed({
					model: provider.embedding(config.embedding.model),
					value: input,
				}),
			catch: (cause) =>
				new AiError({
					operation: "generateEmbedding",
					cause,
				}),
		});
	});

export const generateManyEmbeddings = (params: { values: string[] }) =>
	Effect.gen(function* () {
		const { config } = yield* AiConfigService;
		const provider = yield* getProvider;

		const input = params.values.map((value) => trimNewlines(value));

		return yield* Effect.tryPromise({
			try: () =>
				embedMany({
					model: provider.embedding(config.embedding.model),
					values: input,
				}),
			catch: (cause) =>
				new AiError({
					operation: "generateManyEmbeddings",
					cause,
				}),
		});
	});
