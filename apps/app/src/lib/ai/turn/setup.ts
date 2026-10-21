import { AiError } from "@orcai/ai";
import type { ModelId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import type { DatabaseBlock, ModelTokenLimits } from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import { type AgentModel, agentModel } from "@/lib/ai/agents/agent-model";
import type { AssistantUserContext } from "@/lib/ai/agents/assistant-system-prompt";
import {
	ASSISTANT_AGENT_MAX_STEPS,
	CHAT_AGENT_MAX_STEPS,
} from "@/lib/ai/agents/step-budget";
import {
	type ResolvedFeature,
	resolveFeatures,
} from "@/lib/ai/features/resolve-features";
import {
	type ChatCallSettings,
	chatCallSettings,
} from "@/lib/ai/utils/chat-call-settings";
import { capabilitySets } from "@/lib/authz/capabilities";
import { getZedToken } from "@/lib/authz/zed-token";
import {
	AppConfigService,
	type DocsConfig,
} from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { providerApiKey } from "@/lib/encryption";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type ModelUnusableReason,
	modelUnusableReason,
} from "./model-usability";
import type { StoredChat } from "./reply-store";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

/** The assistant's fixed features. */
const ASSISTANT_FEATURES = {
	generativeUi: {},
};

const UNUSABLE_MESSAGES: Record<ModelUnusableReason, string> = {
	PROVIDER_DISABLED:
		"Selected provider is disabled. Please choose an active provider.",
	MODEL_DEPRECATED:
		"Selected model is deprecated. Please choose a non-deprecated model.",
	MODEL_TOOLS_UNSUPPORTED:
		"Selected model does not support tool calling. Please choose a chat-capable model.",
};

export type TurnRequester = {
	organizationId: OrganizationId;
	/** The signed-in user, who the assistant works for. */
	user: {
		id: UserId;
		name: string;
		email: string;
	};
	/** The request's context, reading at the request's zedToken. */
	context: ORPCContext;
};

/** What a turn runs with, read once before it starts. */
export type TurnSetup = {
	model: AgentModel;
	providerId: ProviderId;
	modelId: ModelId;
	tokenLimits: ModelTokenLimits;
	callSettings: ChatCallSettings;
	maxSteps: number;
	agent:
		| {
				kind: "chat";
				systemPrompt: string;
				databaseBlocks: DatabaseBlock[];
				features: ResolvedFeature[];
		  }
		| {
				kind: "assistant";
				userContext: AssistantUserContext;
				features: ResolvedFeature[];
				docs: DocsConfig | undefined;
		  };
};

const badRequest = (
	reason:
		| ModelUnusableReason
		| "MODEL_PROVIDER_MISMATCH"
		| "CHAT_MODEL_NOT_CONFIGURED"
		| "ASSISTANT_MODEL_NOT_CONFIGURED",
	message: string,
) =>
	new AppErrors.BadRequestError({
		reason,
		message,
	});

const failedRead = (operation: string) => (cause: unknown) =>
	new AiError({
		operation: `turn.setup.${operation}`,
		cause,
	});

/** The model and provider of a turn, refused unless it can carry one. */
const readModel = ({
	modelId,
	requestedProviderId,
	context,
}: {
	modelId: ModelId;
	requestedProviderId: ProviderId | undefined;
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const { data: model } = yield* procedures.model
			.find(
				{
					id: modelId,
				},
				{
					context,
				},
			)
			.pipe(
				Effect.mapError((cause) =>
					cause instanceof ORPCError && cause.code === "NOT_FOUND"
						? new AppErrors.NotFoundError({
								reason: "MODEL_NOT_FOUND",
								id: modelId,
								message:
									"The model of this turn is not available in this organisation.",
							})
						: failedRead("model")(cause),
				),
			);

		if (requestedProviderId && requestedProviderId !== model.providerId) {
			return yield* badRequest(
				"MODEL_PROVIDER_MISMATCH",
				"Selected model does not belong to the selected provider. Please update chat settings.",
			);
		}

		const { data: provider } = yield* procedures.provider
			.find(
				{
					id: model.providerId,
				},
				{
					context,
				},
			)
			.pipe(Effect.mapError(failedRead("provider")));

		const unusable = modelUnusableReason({
			capabilities: model.capabilities,
			isDeprecated: model.isDeprecated,
			providerEnabled: provider.enabled,
		});
		if (unusable) {
			return yield* badRequest(unusable, UNUSABLE_MESSAGES[unusable]);
		}

		const apiKey = yield* providerApiKey(provider.id);

		return {
			model: agentModel({
				kind: provider.kind,
				connection: {
					apiKey,
					endpoint: provider.endpoint,
				},
				providerModelId: model.providerModelId,
				middleware: yield* devToolsMiddleware,
			}),
			providerId: provider.id,
			modelId,
			tokenLimits: {
				contextWindow: model.contextWindow,
				maxOutputTokens: model.maxOutputTokens,
			},
		};
	});

const devToolsMiddleware = Effect.gen(function* () {
	if (
		process.env.NODE_ENV === "production" ||
		process.env.NODE_ENV === "test"
	) {
		return [];
	}
	const devTools = yield* Effect.tryPromise({
		try: () => import("@ai-sdk/devtools"),
		catch: () => null,
	}).pipe(Effect.orElseSucceed(() => null));
	if (!devTools?.devToolsMiddleware) {
		yield* Effect.logWarning(
			"@ai-sdk/devtools unavailable, continuing without devtools middleware",
		);
		return [];
	}
	return [
		devTools.devToolsMiddleware(),
	];
});

/** A bot's template, its database blocks the user may use, and its features. */
const botSettings = ({
	botId,
	userId,
	context,
}: {
	botId: NonNullable<StoredChat["botId"]>;
	userId: UserId;
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const zedToken = getZedToken(context);
		const [blocks, { data: bot }] = yield* Effect.all(
			[
				procedures.block
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
					.pipe(Effect.mapError(failedRead("botBlocks"))),
				procedures.bot
					.find(
						{
							id: botId,
							zedToken,
						},
						{
							context,
						},
					)
					.pipe(Effect.mapError(failedRead("bot"))),
			],
			{
				concurrency: "unbounded",
			},
		);

		const template = blocks.data.find((block) => block.type === "template");
		if (!template) {
			return yield* new AiError({
				operation: "turn.setup.missingTemplateBlock",
				cause: new Error("Bot-linked chat has no template block."),
			});
		}

		const databaseBlocks = blocks.data.filter(
			(block): block is Extract<typeof block, DatabaseBlock> =>
				block.type === "database",
		);
		if (databaseBlocks.length === 0) {
			return {
				template,
				databaseBlocks,
				features: bot.features,
			};
		}

		const usableIds = yield* permittedEntityIds({
			entityIds: databaseBlocks.map((block) => block.id),
			entityType: "block",
			permission: "use",
			userId,
			zedToken,
		});

		return {
			template,
			databaseBlocks: databaseBlocks.filter((block) => usableIds.has(block.id)),
			features: bot.features,
		};
	});

/** Adds the attached blocks the base set does not hold yet. */
const mergeDatabaseBlocks = (
	base: DatabaseBlock[],
	attached: DatabaseBlock[],
) => {
	const ids = new Set(base.map((block) => block.id));
	return [
		...base,
		...attached.filter((block) => {
			if (ids.has(block.id)) {
				return false;
			}
			ids.add(block.id);
			return true;
		}),
	];
};

const chatSetup = (chat: StoredChat, { user, context }: TurnRequester) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const config = chat.config;
		if (!config?.providerId || !config.modelId) {
			return yield* badRequest(
				"CHAT_MODEL_NOT_CONFIGURED",
				"Chat is missing model or provider configuration. Please select a model in chat settings.",
			);
		}

		const [model, bot, attached] = yield* Effect.all(
			[
				readModel({
					modelId: config.modelId,
					requestedProviderId: config.providerId,
					context,
				}),
				chat.botId
					? botSettings({
							botId: chat.botId,
							userId: user.id,
							context,
						})
					: Effect.succeed(undefined),
				procedures.chatBlock
					.list(
						{
							chatId: chat.id,
							zedToken: getZedToken(context),
						},
						{
							context,
						},
					)
					.pipe(
						Effect.mapError(
							(cause) =>
								new AppErrors.BadRequestError({
									reason: "CHAT_BLOCKS_UNAVAILABLE",
									message: "Failed to fetch chat blocks",
									cause,
								}),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		const attachedTemplate = attached.data.find(
			(block) => block.type === "template",
		);

		return {
			...model,
			callSettings: chatCallSettings(config, model.tokenLimits),
			maxSteps: CHAT_AGENT_MAX_STEPS,
			agent: {
				kind: "chat",
				// A bot's template wins, then an attached template, then the chat's own prompt.
				systemPrompt:
					bot?.template.config.systemPrompt ??
					attachedTemplate?.config.systemPrompt ??
					config.systemPrompt ??
					DEFAULT_SYSTEM_PROMPT,
				databaseBlocks: mergeDatabaseBlocks(
					bot?.databaseBlocks ?? [],
					attached.data.filter(
						(block): block is Extract<typeof block, DatabaseBlock> =>
							block.type === "database",
					),
				),
				features: yield* resolveFeatures(bot ? bot.features : config.features),
			},
		} satisfies TurnSetup;
	});

const assistantSetup = ({ organizationId, user, context }: TurnRequester) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const { data: organization } = yield* procedures.organization.find(
			{
				id: organizationId,
			},
			{
				context,
			},
		);
		if (!organization.assistantModelId) {
			return yield* badRequest(
				"ASSISTANT_MODEL_NOT_CONFIGURED",
				"The organisation has no assistant model. An admin can choose one on the organisation page.",
			);
		}

		const [model, member, capabilities] = yield* Effect.all(
			[
				readModel({
					modelId: organization.assistantModelId,
					requestedProviderId: undefined,
					context,
				}),
				procedures.organizationMember.find(
					{
						userId: user.id,
					},
					{
						context,
					},
				),
				procedures.authorization.organizationCapabilities(
					{},
					{
						context,
					},
				),
			],
			{
				concurrency: "unbounded",
			},
		);
		const { docs } = yield* AppConfigService;

		return {
			...model,
			callSettings: {},
			maxSteps: ASSISTANT_AGENT_MAX_STEPS,
			agent: {
				kind: "assistant",
				userContext: {
					user,
					organizationName: organization.name,
					role: member.data.role,
					capabilities: Object.fromEntries(
						capabilitySets.organization.map((permission) => [
							permission,
							capabilities.data.capabilities[permission] === true,
						]),
					) as AssistantUserContext["capabilities"],
				},
				features: yield* resolveFeatures(ASSISTANT_FEATURES),
				docs,
			},
		} satisfies TurnSetup;
	});

/** Reads what a turn on `chat` runs with: the chat's own model, or the organisation's assistant model. */
export const turnSetup = (
	chat: StoredChat,
	requester: TurnRequester,
): Effect.Effect<
	TurnSetup,
	Effect.Error<ReturnType<typeof chatSetup | typeof assistantSetup>>,
	Effect.Services<ReturnType<typeof chatSetup | typeof assistantSetup>>
> =>
	chat.kind === "assistant"
		? assistantSetup(requester)
		: chatSetup(chat, requester);
