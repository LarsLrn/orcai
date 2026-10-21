import { z } from "zod/v4";
import { reportedTokenCount } from "./reported-token-count";
import type { DiscoveredModel, ProviderConnection } from "./types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const modelsPageSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			display_name: z.string(),
			max_input_tokens: reportedTokenCount,
			max_tokens: reportedTokenCount,
		}),
	),
	has_more: z.boolean(),
	last_id: z.string().nullable(),
});

/** Every page of Anthropic's Models API. */
export const listAnthropicModels = async ({
	apiKey,
	fetch = globalThis.fetch,
}: ProviderConnection): Promise<DiscoveredModel[]> => {
	const models: DiscoveredModel[] = [];
	let afterId: string | null = null;

	do {
		const url = new URL(`${ANTHROPIC_API_URL}/models`);
		url.searchParams.set("limit", "1000");
		if (afterId) url.searchParams.set("after_id", afterId);

		const response = await fetch(url, {
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
			},
		});
		if (!response.ok) {
			throw new Error(
				`Anthropic Models API answered ${response.status} ${response.statusText}`,
			);
		}

		const page = modelsPageSchema.parse(await response.json());
		models.push(
			...page.data.map((model) => ({
				providerModelId: model.id,
				name: model.display_name,
				description: `Model ID: ${model.id}`,
				contextWindow: model.max_input_tokens,
				maxOutputTokens: model.max_tokens,
			})),
		);
		if (!page.has_more) {
			afterId = null;
		} else if (page.last_id === null || page.last_id === afterId) {
			throw new Error(
				"Anthropic Models API reported more pages without advancing the cursor",
			);
		} else {
			afterId = page.last_id;
		}
	} while (afterId);

	return models;
};
