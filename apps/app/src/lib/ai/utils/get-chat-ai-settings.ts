import {
	AiError,
	createProviderLanguageModel,
	providerToolLoading,
} from "@orcai/ai";
import type { BotId, ModelId, ProviderId, UserId } from "@orcai/core";
import type { ChatConfig, DatabaseBlock, TemplateBlock } from "@orcai/schema";
import { checkManyEntityPermissions, hasPermission } from "@orcai/spice-db";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import * as Effect from "effect/Effect";
import { resolveFeatures } from "@/lib/ai/features/resolve-features";
import { chatCallSettings } from "@/lib/ai/utils/chat-call-settings";
import { getZedToken } from "@/lib/authz/zed-token";
import { BadRequestError } from "@/lib/effect/utils/errors";
import { providerApiKey } from "@/lib/encryption";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { blockProcedures } from "@/lib/orpc/router/block";
import { botProcedures } from "@/lib/orpc/router/bot";
import { modelProcedures } from "@/lib/orpc/router/model";
import { providerProcedures } from "@/lib/orpc/router/provider";

interface ChatAiSettingsInput {
	providerId: ProviderId;
	modelId: ModelId;
	botId?: BotId | null;
	chatConfig?: ChatConfig | null;
	userId: UserId;
	context: ORPCContext;
}

export const getChatAiSettings = ({
	providerId,
	modelId,
	botId,
	chatConfig,
	userId,
	context,
}: ChatAiSettingsInput) =>
	Effect.gen(function* () {
		const zedToken = getZedToken(context);
		let templateBlock: TemplateBlock | undefined;
		let databaseBlocks: DatabaseBlock[] = [];
		let storedFeatures: unknown = chatConfig?.features;

		if (botId) {
			const [blocks, { data: bot }] = yield* Effect.all(
				[
					blockProcedures
						.list(
							{
								filters: {
									botId,
								},
								zedToken,
							},
							{
								context,
							},
						)
						.pipe(
							Effect.mapError(
								(cause) =>
									new AiError({
										operation: "chatAgent.getChatAiSettings.fetch.blocks",
										cause,
									}),
							),
						),
					botProcedures
						.find(
							{
								id: botId,
								zedToken,
							},
							{
								context,
							},
						)
						.pipe(
							Effect.mapError(
								(cause) =>
									new AiError({
										operation: "chatAgent.getChatAiSettings.fetch.bot",
										cause,
									}),
							),
						),
				],
				{
					concurrency: "unbounded",
				},
			);
			storedFeatures = bot.features;

			const foundTemplateBlock = blocks.data.find(
				(block) => block.type === "template",
			);
			templateBlock =
				foundTemplateBlock?.type === "template"
					? foundTemplateBlock
					: undefined;

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

		const features = yield* resolveFeatures(storedFeatures);

		const systemPrompt =
			templateBlock?.config.systemPrompt ??
			chatConfig?.systemPrompt ??
			"You are a helpful assistant.";

		const [{ data: provider }, { data: modelSettings }] = yield* Effect.all(
			[
				providerProcedures
					.find(
						{
							id: providerId,
						},
						{
							context,
						},
					)
					.pipe(
						Effect.mapError(
							(cause) =>
								new AiError({
									operation: "chatAgent.getChatAiSettings.fetch.provider",
									cause,
								}),
						),
					),
				modelProcedures
					.find(
						{
							id: modelId,
						},
						{
							context,
						},
					)
					.pipe(
						Effect.mapError(
							(cause) =>
								new AiError({
									operation: "chatAgent.getChatAiSettings.fetch.model",
									cause,
								}),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		if (modelSettings.providerId !== provider.id) {
			return yield* new BadRequestError({
				reason: "MODEL_PROVIDER_MISMATCH",
				message:
					"Selected model does not belong to the selected provider. Please update chat settings.",
			});
		}

		if (!provider.enabled) {
			return yield* new BadRequestError({
				reason: "PROVIDER_DISABLED",
				message:
					"Selected provider is disabled. Please choose an active provider.",
			});
		}

		if (modelSettings.isDeprecated) {
			return yield* new BadRequestError({
				reason: "MODEL_DEPRECATED",
				message:
					"Selected model is deprecated. Please choose a non-deprecated model.",
			});
		}

		const apiKey = yield* providerApiKey(provider.id);

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
			model: createProviderLanguageModel(
				provider.kind,
				{
					apiKey,
					endpoint: provider.endpoint,
				},
				modelSettings.providerModelId,
			),
			middleware: middlewares,
		});

		return {
			provider,
			model,
			toolLoading: providerToolLoading(
				provider.kind,
				modelSettings.providerModelId,
			),
			systemPrompt,
			databaseBlocks,
			features,
			callSettings: chatCallSettings(chatConfig),
		};
	});
