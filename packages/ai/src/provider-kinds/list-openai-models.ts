import OpenAI from "openai";
import { z } from "zod/v4";
import { reportedTokenCount } from "./reported-token-count";
import type { DiscoveredModel, ProviderConnection } from "./types";

/** Limits some OpenAI-compatible servers add to `/models`; OpenAI's API has none. */
const reportedLimitsSchema = z.object({
	/** OpenRouter, Together AI */
	context_length: reportedTokenCount,
	/** vLLM */
	max_model_len: reportedTokenCount,
	/** Groq */
	context_window: reportedTokenCount,
	/** Groq */
	max_completion_tokens: reportedTokenCount,
	/** OpenRouter */
	top_provider: z
		.object({
			max_completion_tokens: reportedTokenCount,
		})
		.nullable()
		.catch(null),
});

const reportedLimits = (
	model: OpenAI.Models.Model,
): Pick<DiscoveredModel, "contextWindow" | "maxOutputTokens"> => {
	const limits = reportedLimitsSchema.parse(model);
	return {
		contextWindow:
			limits.context_length ?? limits.max_model_len ?? limits.context_window,
		maxOutputTokens:
			limits.top_provider?.max_completion_tokens ??
			limits.max_completion_tokens,
	};
};

/** `GET /models` of the endpoint, or of OpenAI's API without one. */
export const listOpenAIModels = async ({
	apiKey,
	endpoint,
	fetch,
}: ProviderConnection): Promise<DiscoveredModel[]> => {
	const client = new OpenAI({
		apiKey,
		baseURL: endpoint ?? undefined,
		fetch,
	});

	const models: DiscoveredModel[] = [];
	for await (const model of client.models.list()) {
		models.push({
			providerModelId: model.id,
			name: model.id,
			description: `Model ID: ${model.id} | Owned by ${model.owned_by}`,
			...reportedLimits(model),
		});
	}
	return models;
};
