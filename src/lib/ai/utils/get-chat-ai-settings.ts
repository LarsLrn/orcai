import { devToolsMiddleware } from "@ai-sdk/devtools";
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
		const baseProvider = yield* Effect.tryPromise({
			try: () => client.provider.find({ slug: templateBlock.config.provider }),
			catch: (cause) =>
				new AiError({
					operation: "chatAgent.getChatAiSettings.fetch.provider",
					cause,
				}),
		});

		const organizationProviderSettings = yield* Effect.tryPromise({
			try: () =>
				client.organizationProvider.find({
					providerSlug: templateBlock.config.provider,
				}),
			catch: (cause) =>
				new AiError({
					operation: "chatAgent.getChatAiSettings.fetch.organizationProvider",
					cause,
				}),
		});

		const apiKey = yield* decryptApiKey(
			organizationProviderSettings.data.apiKeyEncrypted,
		);

		const provider = createOpenAICompatible({
			baseURL: baseProvider.data.endpoint ?? "", // TODO: Fix?
			apiKey,
			name: baseProvider.data.slug,
			includeUsage: true,
		});

		const model = wrapLanguageModel({
			model: provider(templateBlock.config.model),
			middleware: [
				devToolsMiddleware(),
				extractReasoningMiddleware({ tagName: "think" }),
			],
		});

		return { provider, model };
	});
