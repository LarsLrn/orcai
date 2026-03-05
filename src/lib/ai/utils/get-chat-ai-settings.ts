import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import * as Effect from "effect/Effect";
import { AiError } from "@/lib/effect/utils/errors";
import { decryptApiKey } from "@/lib/encryption";
import { client } from "@/lib/orpc/orpc";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

export const getChatAiSettings = ({
	templateBlock,
}: {
	templateBlock: TemplateBlock;
}) =>
	Effect.gen(function* () {
		const [{ data: provider }, { data: modelSettings }] = yield* Effect.all(
			[
				Effect.tryPromise({
					try: () =>
						client.provider.find({
							id: templateBlock.config.provider,
						}),
					catch: (cause) =>
						new AiError({
							operation: "chatAgent.getChatAiSettings.fetch.provider",
							cause,
						}),
				}),
				Effect.tryPromise({
					try: () =>
						client.model.find({
							id: templateBlock.config.model,
						}),
					catch: (cause) =>
						new AiError({
							operation: "chatAgent.getChatAiSettings.fetch.model",
							cause,
						}),
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		const apiKey = yield* decryptApiKey(provider.apiKeyEncrypted);

		const providerInstance = createOpenAICompatible({
			baseURL: provider.endpoint ?? "", // TODO: Fix?
			apiKey,
			name: provider.name,
			includeUsage: true,
		});

		const middlewares = [
			extractReasoningMiddleware({
				tagName: "think",
			}),
		];

		if (process.env.NODE_ENV !== "production") {
			const { devToolsMiddleware } = yield* Effect.tryPromise({
				try: () => import("@ai-sdk/devtools"),
				catch: (cause) =>
					new AiError({
						operation: "chatAgent.getChatAiSettings.load.devtools",
						cause,
					}),
			});

			middlewares.unshift(devToolsMiddleware());
		}

		const model = wrapLanguageModel({
			model: providerInstance(modelSettings.providerModelId),
			middleware: middlewares,
		});

		return {
			provider,
			model,
		};
	});
