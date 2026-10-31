import { modelCapabilities } from "@orcai/core";
import type { ModelCapability } from "@orcai/schema";
import OpenAI from "openai";
import { z } from "zod/v4";
import { reportedTokenCount } from "./reported-token-count";
import type { DiscoveredModel, ProviderConnection } from "./types";

/** What every server's `/models` answers; the rest of a model is optional. */
const listingSchema = z.object({
	data: z.array(
		z.looseObject({
			id: z.string().min(1),
			owned_by: z.string().optional(),
		}),
	),
});

type ListedModel = z.infer<typeof listingSchema>["data"][number];

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
	model: ListedModel,
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

/** OpenRouter's model metadata; OpenAI's API and most other servers have none. */
const reportedMetadataSchema = z.object({
	architecture: z.object({
		input_modalities: z.array(z.string()),
		output_modalities: z.array(z.string()),
	}),
	supported_parameters: z.array(z.string()),
});

const inputCapabilities: Record<string, ModelCapability> = {
	image: "image",
	audio: "audio",
	video: "video",
};

const outputCapabilities: Record<string, ModelCapability> = {
	text: "text",
	embeddings: "embedding",
	image: "image-generation",
	audio: "audio-generation",
};

const parameterCapabilities: Record<string, ModelCapability> = {
	tools: "tool-calling",
	reasoning: "reasoning",
	include_reasoning: "reasoning",
};

const reportedCapabilities = (
	model: ListedModel,
): DiscoveredModel["capabilities"] => {
	const metadata = reportedMetadataSchema.safeParse(model);
	if (!metadata.success) return null;
	const { architecture, supported_parameters } = metadata.data;
	const reported = new Set(
		[
			...architecture.input_modalities.map((input) => inputCapabilities[input]),
			...architecture.output_modalities.map(
				(output) => outputCapabilities[output],
			),
			...supported_parameters.map(
				(parameter) => parameterCapabilities[parameter],
			),
		].filter((capability) => capability !== undefined),
	);
	return modelCapabilities.filter((capability) => reported.has(capability));
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

	const response = await client.models.list().asResponse();
	return listingSchema.parse(await response.json()).data.map((model) => ({
		providerModelId: model.id,
		name: model.id,
		description: model.owned_by
			? `Model ID: ${model.id} | Owned by ${model.owned_by}`
			: `Model ID: ${model.id}`,
		...reportedLimits(model),
		capabilities: reportedCapabilities(model),
	}));
};
