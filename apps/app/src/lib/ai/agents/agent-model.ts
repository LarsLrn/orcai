import {
	createProviderLanguageModel,
	type ProviderConnection,
	providerToolLoading,
	type ToolLoading,
} from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import {
	extractReasoningMiddleware,
	type LanguageModel,
	type LanguageModelMiddleware,
	wrapLanguageModel,
} from "ai";

/** A model with the behaviour of its provider kind. */
export interface AgentModel {
	readonly language: LanguageModel;
	readonly kind: ProviderKind;
	readonly toolLoading: ToolLoading;
}

export const agentModel = ({
	kind,
	connection,
	providerModelId,
	middleware = [],
}: {
	kind: ProviderKind;
	connection: ProviderConnection;
	providerModelId: string;
	middleware?: LanguageModelMiddleware[];
}): AgentModel => ({
	language: wrapLanguageModel({
		model: createProviderLanguageModel(kind, connection, providerModelId),
		middleware: [
			...middleware,
			extractReasoningMiddleware({
				tagName: "think",
			}),
		],
	}),
	kind,
	toolLoading: providerToolLoading(kind, providerModelId),
});
