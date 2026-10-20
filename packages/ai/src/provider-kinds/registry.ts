import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { ProviderKind } from "@orcai/core";
import type { SystemModelMessage } from "ai";
import { listAnthropicModels } from "./list-anthropic-models";
import { listOpenAIModels } from "./list-openai-models";
import type {
	DiscoveredModel,
	ProviderConnection,
	SystemPrompt,
} from "./types";

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
}

const requireEndpoint = ({ endpoint }: ProviderConnection) => {
	if (endpoint === null) {
		throw new Error("This provider kind needs an endpoint.");
	}
	return endpoint;
};

export const providerKindServerEntries: Record<
	ProviderKind,
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
	},
};

export const createProviderLanguageModel = (
	kind: ProviderKind,
	connection: ProviderConnection,
	modelId: string,
) => providerKindServerEntries[kind].createLanguageModel(connection, modelId);

export const listProviderModels = (
	kind: ProviderKind,
	connection: ProviderConnection,
) => providerKindServerEntries[kind].listModels(connection);

/**
 * The system messages of a call. Kinds that cache get the stable part on its
 * own; the others get one message, which every chat template accepts.
 */
export const buildSystemInstructions = (
	kind: ProviderKind,
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
