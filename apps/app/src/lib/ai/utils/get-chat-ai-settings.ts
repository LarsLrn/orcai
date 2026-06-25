import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AiError } from "@orcai/ai";
import type { BotId, ModelId, ProviderId, UserId } from "@orcai/core";
import type { ChatConfig, DatabaseBlock, TemplateBlock } from "@orcai/schema";
import { checkManyEntityPermissions, hasPermission } from "@orcai/spice-db";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import * as Effect from "effect/Effect";
import { resolveChatGenerationParams } from "@/lib/ai/utils/chat-generation-defaults";
import { BadRequestError } from "@/lib/effect/utils/errors";
import { decryptApiKey } from "@/lib/encryption";
import { client } from "@/lib/orpc/orpc";

interface ChatAiSettingsInput {
	providerId: ProviderId;
	modelId: ModelId;
	botId?: BotId | null;
	chatConfig?: ChatConfig | null;
	userId: UserId;
	zedToken?: string;
}

export const getChatAiSettings = ({
	providerId,
	modelId,
	botId,
	chatConfig,
	userId,
	zedToken,
}: ChatAiSettingsInput) =>
	Effect.gen(function* () {
		let templateBlock: TemplateBlock | undefined;
		let databaseBlocks: DatabaseBlock[] = [];

		if (botId) {
			const blocks = yield* Effect.tryPromise({
				try: () =>
					client.block.list({
						filters: {
							botId,
						},
					}),
				catch: (cause) =>
					new AiError({
						operation: "chatAgent.getChatAiSettings.fetch.blocks",
						cause,
					}),
			});

			templateBlock = blocks.data.find(
				(block): block is TemplateBlock => block.type === "template",
			);

			if (!templateBlock) {
				return yield* new AiError({
					operation: "chatAgent.getChatAiSettings.missingTemplateBlock",
					cause: new Error("Bot-linked chat has no template block."),
				});
			}

			databaseBlocks = blocks.data.filter(
				(block) => block.type === "database",
			) as DatabaseBlock[];

			if (databaseBlocks.length > 0) {
				const usePermissionResult = yield* checkManyEntityPermissions({
					entityIds: databaseBlocks.map((block) => block.id),
					entityType: "block",
					permission: "use",
					userId,
					zedToken,
				});

				const allowedBlockIds = new Set(
					usePermissionResult.pairs
						.map((pair) => {
							const allowed =
								pair.response.oneofKind === "item" &&
								hasPermission({
									permissionship: pair.response.item.permissionship,
								}) === true;
							const id = pair.request?.resource?.objectId;
							return allowed && id ? id : undefined;
						})
						.filter((id): id is string => id !== undefined),
				);

				databaseBlocks = databaseBlocks.filter((block) =>
					allowedBlockIds.has(block.id),
				);
			}
		}

		const systemPrompt =
			templateBlock?.config.systemPrompt ??
			chatConfig?.systemPrompt ??
			"You are a helpful assistant.";

		const [{ data: provider }, { data: modelSettings }] = yield* Effect.all(
			[
				Effect.tryPromise({
					try: () =>
						client.provider.find({
							id: providerId,
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
							id: modelId,
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

		if (modelSettings.providerId !== provider.id) {
			return yield* new BadRequestError({
				message:
					"Selected model does not belong to the selected provider. Please update chat settings.",
			});
		}

		if (!provider.enabled) {
			return yield* new BadRequestError({
				message:
					"Selected provider is disabled. Please choose an active provider.",
			});
		}

		if (modelSettings.isDeprecated) {
			return yield* new BadRequestError({
				message:
					"Selected model is deprecated. Please choose a non-deprecated model.",
			});
		}

		const apiKey = yield* decryptApiKey(provider.apiKeyEncrypted);

		const providerInstance = createOpenAICompatible({
			baseURL: provider.endpoint ?? "",
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
			const devToolsModule = yield* Effect.tryPromise({
				try: () => import("@ai-sdk/devtools"),
				catch: () => null,
			});
			if (devToolsModule?.devToolsMiddleware) {
				middlewares.unshift(devToolsModule.devToolsMiddleware());
			} else {
				yield* Effect.logWarning(
					"@ai-sdk/devtools unavailable, continuing without devtools middleware",
				);
			}
		}

		const model = wrapLanguageModel({
			model: providerInstance(modelSettings.providerModelId),
			middleware: middlewares,
		});

		const generationParams = resolveChatGenerationParams(chatConfig);

		return {
			provider,
			model,
			systemPrompt,
			databaseBlocks,
			generationParams,
		};
	});
