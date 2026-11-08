import { modelCapabilities } from "@orcai/core";
import type { ModelCapability } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { decodeListing, getListing, ModelListingError } from "./listing";
import { reportedTokenCount } from "./reported-token-count";
import type { DiscoveredModel, ProviderConnection } from "./types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const supportSchema = z.object({
	supported: z.boolean(),
});

const reportedCapabilitiesSchema = z
	.object({
		image_input: supportSchema,
		thinking: supportSchema,
	})
	.nullable()
	.catch(null);

/** Every Claude model takes text and tools; the API reports the rest, if anything. */
const capabilitiesOf = (
	reported: z.infer<typeof reportedCapabilitiesSchema>,
): ModelCapability[] => {
	const supported: Partial<Record<ModelCapability, boolean>> = {
		text: true,
		image: reported?.image_input.supported,
		reasoning: reported?.thinking.supported,
		"tool-calling": true,
	};
	return modelCapabilities.filter((capability) => supported[capability]);
};

const modelsPageSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			display_name: z.string(),
			max_input_tokens: reportedTokenCount,
			max_tokens: reportedTokenCount,
			capabilities: reportedCapabilitiesSchema,
		}),
	),
	has_more: z.boolean(),
	last_id: z.string().nullable(),
});

/** Every page of Anthropic's Models API. */
export const listAnthropicModels = ({
	apiKey,
	fetch = globalThis.fetch,
}: ProviderConnection) =>
	Effect.gen(function* () {
		const models: DiscoveredModel[] = [];
		let afterId: string | null = null;

		do {
			const url = new URL(`${ANTHROPIC_API_URL}/models`);
			url.searchParams.set("limit", "1000");
			if (afterId) url.searchParams.set("after_id", afterId);

			const page = yield* getListing(fetch, url, {
				"x-api-key": apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
			}).pipe(Effect.flatMap((body) => decodeListing(modelsPageSchema, body)));
			models.push(
				...page.data.map((model) => ({
					providerModelId: model.id,
					name: model.display_name,
					description: `Model ID: ${model.id}`,
					contextWindow: model.max_input_tokens,
					maxOutputTokens: model.max_tokens,
					capabilities: capabilitiesOf(model.capabilities),
				})),
			);
			if (!page.has_more) {
				afterId = null;
			} else if (page.last_id === null || page.last_id === afterId) {
				return yield* new ModelListingError({
					failure: "invalid-response",
					cause: new Error(
						"Anthropic Models API reported more pages without advancing the cursor",
					),
				});
			} else {
				afterId = page.last_id;
			}
		} while (afterId);

		return models;
	});
