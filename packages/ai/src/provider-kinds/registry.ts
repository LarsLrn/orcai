import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
	LanguageModelV4,
	SharedV4ProviderOptions,
} from "@ai-sdk/provider";
import type { CompactionSource, ModelProviderKind } from "@orcai/core";
import type { SystemModelMessage, Tool, ToolResultPart } from "ai";
import { COMPACTION_INSTRUCTIONS } from "./compaction";
import { listAnthropicModels } from "./list-anthropic-models";
import { listOpenAIModels } from "./list-openai-models";
import { classifyListingFailure } from "./listing-error";
import type {
	DiscoveredModel,
	ProviderConnection,
	SystemPrompt,
} from "./types";

type ToolResultContentPart = Extract<
	ToolResultPart["output"],
	{
		type: "content";
	}
>["value"][number];

/** How an agent offers the tools it loads on demand. */
export type ToolLoading =
	/** Only the loaded tools are sent, so loading changes the request's tool list. */
	| {
			readonly type: "active-tools";
	  }
	/** Every tool is sent from the start, deferred; references in tool results load them. */
	| {
			readonly type: "references";
			/** Declares a tool that stays out of the model's context until referenced. */
			readonly deferredToolOptions: NonNullable<Tool["providerOptions"]>;
			/** A tool result part that loads the named deferred tool. */
			readonly reference: (toolName: string) => ToolResultContentPart;
	  };

const activeToolsLoading: ToolLoading = {
	type: "active-tools",
};

/** Claude models before tool search: Claude 3, and Opus and Sonnet 4 up to 4.1. */
const ANTHROPIC_MODELS_WITHOUT_TOOL_SEARCH =
	/^claude-(3|(opus|sonnet)-4-(0|1|\d{8})(-|$))/;

/** Searches one Anthropic request may run; a turn's steps are separate requests. */
const ANTHROPIC_WEB_SEARCHES_PER_TURN = 5;

const anthropicReferences: ToolLoading = {
	type: "references",
	deferredToolOptions: {
		anthropic: {
			deferLoading: true,
		},
	},
	reference: (toolName) => ({
		type: "custom",
		providerOptions: {
			anthropic: {
				type: "tool-reference",
				toolName,
			},
		},
	}),
};

/** Compaction on the provider's server once a prompt reaches the trigger. */
interface NativeCompaction {
	readonly source: Exclude<CompactionSource, "summary">;
	/** The smallest trigger the provider accepts. */
	readonly minimumTrigger: number;
	readonly providerOptions: (trigger: number) => SharedV4ProviderOptions;
}

export interface ProviderKindServerEntry {
	readonly createLanguageModel: (
		connection: ProviderConnection,
		modelId: string,
	) => LanguageModelV4;
	readonly listModels: (
		connection: ProviderConnection,
	) => Promise<DiscoveredModel[]>;
	/** Sent on the stable system part; set for kinds that cache prompts. */
	readonly stablePromptOptions?: SystemModelMessage["providerOptions"];
	/**
	 * Whether `toolChoice: "none"` keeps the tool list in the request. The
	 * Anthropic provider drops the list instead, which changes the prefix that
	 * cached prompts and thinking blocks are bound to.
	 */
	readonly toolChoiceNoneKeepsTools: boolean;
	/** Defaults to active tools. */
	readonly toolLoading?: (modelId: string) => ToolLoading;
	/** Sent with every call of the kind. */
	readonly callProviderOptions?: SharedV4ProviderOptions;
	/** Without it, our own summary compacts. */
	readonly compaction?: NativeCompaction;
	/** A JSON answer is asked for without its schema, so the prompt lists the fields. */
	readonly jsonWithoutSchema?: true;
	/** How a chat title is asked for, set where the SDK turns reasoning off safely. */
	readonly titleCallSettings?: TitleCallSettings;
	/** The provider's own search tool, set for kinds with `nativeWebSearch`. */
	readonly webSearchTool?: (allowedDomains: readonly string[]) => Tool;
}

export interface TitleCallSettings {
	readonly reasoning?: "none";
	readonly maxOutputTokens?: number;
}

const requireEndpoint = ({ endpoint }: ProviderConnection) => {
	if (endpoint === null) {
		throw new Error("This provider kind needs an endpoint.");
	}
	return endpoint;
};

export const providerKindServerEntries: Record<
	ModelProviderKind,
	ProviderKindServerEntry
> = {
	"openai-compatible": {
		createLanguageModel: (connection, modelId) =>
			createOpenAICompatible({
				name: "openai-compatible",
				baseURL: requireEndpoint(connection),
				apiKey: connection.apiKey,
				fetch: connection.fetch,
				includeUsage: true,
			})(modelId),
		listModels: (connection) =>
			listOpenAIModels({
				...connection,
				endpoint: requireEndpoint(connection),
			}),
		toolChoiceNoneKeepsTools: true,
		// JSON mode: many servers behind this kind take no JSON schema.
		jsonWithoutSchema: true,
	},
	openai: {
		createLanguageModel: ({ apiKey, fetch }, modelId) =>
			createOpenAI({
				apiKey,
				fetch,
			})(modelId),
		listModels: ({ apiKey, fetch }) =>
			listOpenAIModels({
				apiKey,
				endpoint: null,
				fetch,
			}),
		toolChoiceNoneKeepsTools: true,
		webSearchTool: (allowedDomains) =>
			openai.tools.webSearch(
				allowedDomains.length > 0
					? {
							filters: {
								allowedDomains: [
									...allowedDomains,
								],
							},
						}
					: {},
			),
		// Replays compaction and reasoning from what we stored, not from OpenAI's copy.
		callProviderOptions: {
			openai: {
				store: false,
			},
		},
		compaction: {
			source: "openai",
			minimumTrigger: 0,
			providerOptions: (trigger) => ({
				openai: {
					contextManagement: [
						{
							type: "compaction",
							compactThreshold: trigger,
						},
					],
				},
			}),
		},
	},
	anthropic: {
		createLanguageModel: ({ apiKey, fetch }, modelId) =>
			createAnthropic({
				apiKey,
				fetch,
			})(modelId),
		listModels: listAnthropicModels,
		stablePromptOptions: {
			anthropic: {
				cacheControl: {
					type: "ephemeral",
				},
			},
		},
		// Each call caches up to its last block, so a turn's steps read the history from cache.
		callProviderOptions: {
			anthropic: {
				cacheControl: {
					type: "ephemeral",
				},
			},
		},
		toolChoiceNoneKeepsTools: false,
		webSearchTool: (allowedDomains) =>
			anthropic.tools.webSearch_20260318({
				maxUses: ANTHROPIC_WEB_SEARCHES_PER_TURN,
				...(allowedDomains.length > 0 && {
					allowedDomains: [
						...allowedDomains,
					],
				}),
			}),
		toolLoading: (modelId) =>
			ANTHROPIC_MODELS_WITHOUT_TOOL_SEARCH.test(modelId)
				? activeToolsLoading
				: anthropicReferences,
		// Models that cannot turn thinking off get low effort, which the cap leaves room for.
		titleCallSettings: {
			reasoning: "none",
			maxOutputTokens: 256,
		},
		compaction: {
			source: "anthropic",
			minimumTrigger: 50_000,
			providerOptions: (trigger) => ({
				anthropic: {
					contextManagement: {
						edits: [
							{
								type: "compact_20260112",
								trigger: {
									type: "input_tokens",
									value: trigger,
								},
								instructions: COMPACTION_INSTRUCTIONS,
							},
						],
					},
				},
			}),
		},
	},
};

export const titleCallSettings = (kind: ModelProviderKind): TitleCallSettings =>
	providerKindServerEntries[kind].titleCallSettings ?? {};

export const createProviderLanguageModel = (
	kind: ModelProviderKind,
	connection: ProviderConnection,
	modelId: string,
) => providerKindServerEntries[kind].createLanguageModel(connection, modelId);

export const providerToolLoading = (
	kind: ModelProviderKind,
	modelId: string,
): ToolLoading =>
	providerKindServerEntries[kind].toolLoading?.(modelId) ?? activeToolsLoading;

/** The tool name provider search tools are offered under. */
export const NATIVE_WEB_SEARCH_TOOL_NAME = "web_search";

/** The kind's own web search tool, or undefined for kinds without one. */
export const nativeWebSearchTool = (
	kind: ModelProviderKind,
	allowedDomains: readonly string[],
): Tool | undefined =>
	providerKindServerEntries[kind].webSearchTool?.(allowedDomains);

/** Rejects with a `ModelListingError` where the failure has a class. */
export const listProviderModels = (
	kind: ModelProviderKind,
	connection: ProviderConnection,
) =>
	providerKindServerEntries[kind].listModels(connection).catch((cause) => {
		throw classifyListingFailure(cause);
	});

/** Step settings that rule out tool calls where the kind keeps its tool list. */
export const withholdToolCalls = (
	kind: ModelProviderKind,
): {
	toolChoice?: "none";
} =>
	providerKindServerEntries[kind].toolChoiceNoneKeepsTools
		? {
				toolChoice: "none",
			}
		: {};

/**
 * The system messages of a call. Kinds that cache get the stable part on its
 * own; the others get one message, which every chat template accepts.
 */
export const buildSystemInstructions = (
	kind: ModelProviderKind,
	{ stable, variable }: SystemPrompt,
): SystemModelMessage[] => {
	const { stablePromptOptions } = providerKindServerEntries[kind];

	if (!stablePromptOptions) {
		return [
			{
				role: "system",
				content: [
					stable,
					variable,
				]
					.filter(Boolean)
					.join("\n\n"),
			},
		];
	}

	return [
		{
			role: "system",
			content: stable,
			providerOptions: stablePromptOptions,
		},
		...(variable
			? [
					{
						role: "system" as const,
						content: variable,
					},
				]
			: []),
	];
};

/** How a kind's turn compacts a prompt that reaches `trigger` tokens. */
export interface ProviderCompaction {
	/** The provider compacts; otherwise our own summary does. */
	readonly native: boolean;
	/** What every call of the turn sends. */
	readonly providerOptions: SharedV4ProviderOptions | undefined;
	/** The compaction parts the turn reads back: our summaries, and its own native ones. */
	readonly reads: (source: CompactionSource) => boolean;
}

export const providerCompaction = (
	kind: ModelProviderKind,
	trigger: number,
): ProviderCompaction => {
	const { callProviderOptions, compaction } = providerKindServerEntries[kind];
	const native =
		compaction !== undefined && trigger >= compaction.minimumTrigger
			? compaction
			: undefined;
	const nativeOptions = native?.providerOptions(trigger);
	const providers = new Set([
		...Object.keys(callProviderOptions ?? {}),
		...Object.keys(nativeOptions ?? {}),
	]);

	return {
		native: native !== undefined,
		providerOptions:
			providers.size === 0
				? undefined
				: Object.fromEntries(
						[
							...providers,
						].map((provider) => [
							provider,
							{
								...callProviderOptions?.[provider],
								...nativeOptions?.[provider],
							},
						]),
					),
		reads: (source) => source === "summary" || source === native?.source,
	};
};
