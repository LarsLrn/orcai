import {
	type AgentModel,
	AiError,
	agentModel,
	type ProviderCompaction,
	providerApiKey,
	providerCompaction,
} from "@orcai/ai";
import {
	type BotId,
	isModelProviderKind,
	type ModelId,
	type OrganizationId,
	type ProviderId,
	type UserId,
} from "@orcai/core";
import { reservedOutputTokens } from "@orcai/quota";
import {
	type DatabaseBlock,
	type ModelTokenLimits,
	type ModelUnusableReason,
	modelUnusableReason,
} from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { AssistantUserContext } from "@/lib/ai/agents/assistant-system-prompt";
import {
	ASSISTANT_AGENT_MAX_STEPS,
	CHAT_AGENT_MAX_STEPS,
} from "@/lib/ai/agents/step-budget";
import {
	type ResolvedFeature,
	resolveFeatures,
} from "@/lib/ai/features/resolve-features";
import { NO_WEB_SEARCH, type TurnWebSearch } from "@/lib/ai/tools/web/toolset";
import { turnWebSearch } from "@/lib/ai/tools/web/turn-web-search";
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
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	compactionTrigger,
	DEFAULT_CONTEXT_WINDOW,
	promptBudget,
} from "./context-window";
import type { StoredChat } from "./reply-store";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

/** The assistant's fixed features. */
const ASSISTANT_FEATURES = {
	generativeUi: {},
	questions: {},
};

const UNUSABLE_MESSAGES: Record<ModelUnusableReason<"turn">, string> = {
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

type RequestedSetup = {
	model: AgentModel;
	providerId: ProviderId;
	modelId: ModelId;
	/** The bot of the chat, which its metered calls record. */
	botId: BotId | null;
	tokenLimits: ModelTokenLimits;
	callSettings: ChatCallSettings;
	maxSteps: number;
	agent:
		| {
				kind: "chat";
				systemPrompt: string;
				databaseBlocks: DatabaseBlock[];
				features: ResolvedFeature[];
				webSearch: TurnWebSearch;
		  }
		| {
				kind: "assistant";
				userContext: AssistantUserContext;
				features: ResolvedFeature[];
				docs: DocsConfig | undefined;
		  };
};

/** What a turn runs with, read once before it starts. */
export type TurnSetup = RequestedSetup & {
	/** Every step asks for at most the output that fitting and quota reserve. */
	callSettings: {
		maxOutputTokens: number;
	};
	/** The tokens the prompt may take. */
	budget: number;
	compaction: ProviderCompaction;
};

const badRequest = (
	reason:
		| ModelUnusableReason<"turn">
		| "MODEL_PROVIDER_MISMATCH"
		| "PROVIDER_PURPOSE_MISMATCH"
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

		const unusable = modelUnusableReason(
			{
				capabilities: model.capabilities,
				isDeprecated: model.isDeprecated,
				providerEnabled: provider.enabled,
			},
			"turn",
		);
		if (unusable) {
			return yield* badRequest(unusable, UNUSABLE_MESSAGES[unusable]);
		}
		const { kind } = provider;
		if (!isModelProviderKind(kind)) {
			return yield* badRequest(
				"PROVIDER_PURPOSE_MISMATCH",
				"Selected model belongs to a search provider. Please choose a chat model.",
			);
		}

		const apiKey = yield* providerApiKey(provider.id);

		return {
			model: agentModel({
				kind,
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

const chatSetup = (
	chat: StoredChat,
	{ organizationId, user, context }: TurnRequester,
) =>
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
		const features = yield* resolveFeatures(
			bot ? bot.features : config.features,
		);
		// Only bots enable web search.
		const webSearch =
			chat.botId && features.some(({ id }) => id === "webSearch")
				? yield* turnWebSearch({
						organizationId,
						userId: user.id,
						botId: chat.botId,
						modelKind: model.model.kind,
						context,
					})
				: NO_WEB_SEARCH;

		return {
			...model,
			botId: chat.botId,
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
				features,
				webSearch,
			},
		} satisfies RequestedSetup;
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
			botId: null,
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
		} satisfies RequestedSetup;
	});

/**
 * Without its own cap a call reserves a guess at its output, which leaves at
 * least half the context window to the prompt. The rest is the budget, which
 * sets where the conversation compacts.
 */
const withLimits = (setup: RequestedSetup): TurnSetup => {
	const { contextWindow } = setup.tokenLimits;
	const half = Math.floor((contextWindow ?? DEFAULT_CONTEXT_WINDOW) / 2);
	const maxOutputTokens =
		setup.callSettings.maxOutputTokens ??
		Math.min(
			half,
			reservedOutputTokens({
				modelMaxOutputTokens: setup.tokenLimits.maxOutputTokens,
			}),
		);
	const budget = promptBudget({
		contextWindow,
		reservedOutputTokens: maxOutputTokens,
	});
	return {
		...setup,
		callSettings: {
			...setup.callSettings,
			maxOutputTokens,
		},
		budget,
		compaction: providerCompaction(setup.model.kind, compactionTrigger(budget)),
	};
};

type SetupOf = ReturnType<typeof chatSetup | typeof assistantSetup>;

/** Reads what a turn on `chat` runs with: the chat's own model, or the organisation's assistant model. */
export const turnSetup = (
	chat: StoredChat,
	requester: TurnRequester,
): Effect.Effect<
	TurnSetup,
	Effect.Error<SetupOf>,
	Effect.Services<SetupOf>
> => {
	const requested: Effect.Effect<
		RequestedSetup,
		Effect.Error<SetupOf>,
		Effect.Services<SetupOf>
	> = chat.kind === "assistant"
		? assistantSetup(requester)
		: chatSetup(chat, requester);
	return Effect.map(requested, withLimits);
};
