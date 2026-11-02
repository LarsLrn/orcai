import {
	discoverEmbeddingModelsInputSchema,
	discoverEmbeddingModelsResponseSchema,
	findEmbeddingsStatusInputSchema,
	findEmbeddingsStatusResponseSchema,
	findInstanceSettingsInputSchema,
	findInstanceSettingsResponseSchema,
	updateEmbeddingSettingsInputSchema,
	updateEmbeddingSettingsResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tags = [
	"Instance settings",
];

export const instanceSettingsContracts = {
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/settings",
				summary: "Read the instance settings",
				tags,
			}),
		)
		.input(findInstanceSettingsInputSchema)
		.output(findInstanceSettingsResponseSchema),
	embeddingsStatus: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/settings/embeddings/status",
				summary: "Whether embeddings are set up, so files can be searched",
				tags,
			}),
		)
		.input(findEmbeddingsStatusInputSchema)
		.output(findEmbeddingsStatusResponseSchema),
	discoverEmbeddingModels: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/settings/embeddings/models",
				summary: "List the models of an embedding endpoint",
				tags,
				description:
					"Without an API key, the stored one is used. Endpoints without a model list answer an empty one.",
			}),
		)
		.input(discoverEmbeddingModelsInputSchema)
		.output(discoverEmbeddingModelsResponseSchema),
	updateEmbeddings: base
		.meta(
			openapi({
				method: "PUT",
				path: "/instance/settings/embeddings",
				summary: "Set the embedding endpoint",
				tags,
				description:
					"Runs a test embedding first and stores nothing when it fails. The dimensions come from its result. Without an API key, the stored one is kept.",
			}),
		)
		.input(updateEmbeddingSettingsInputSchema)
		.output(updateEmbeddingSettingsResponseSchema),
};
