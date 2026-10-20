import OpenAI from "openai";
import type { DiscoveredModel, ProviderConnection } from "./types";

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
		});
	}
	return models;
};
