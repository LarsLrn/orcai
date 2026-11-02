import {
	discoverEmbeddingModelsInputSchema,
	discoverEmbeddingModelsResponseSchema,
	findEmbeddingProgressInputSchema,
	findEmbeddingProgressResponseSchema,
	findEmbeddingsStatusInputSchema,
	findEmbeddingsStatusResponseSchema,
	findInstanceSettingsInputSchema,
	findInstanceSettingsResponseSchema,
	reembedEmbeddingsInputSchema,
	reembedEmbeddingsResponseSchema,
	retryFailedEmbeddingsInputSchema,
	retryFailedEmbeddingsResponseSchema,
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
				summary:
					"Whether embeddings are set up and whether files are being re-embedded",
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
					"Runs a test embedding first and stores nothing when it fails. The dimensions come from its result. Without an API key, the stored one is kept. Another model or another size re-embeds every file into a new collection and needs `reembed`.",
			}),
		)
		.input(updateEmbeddingSettingsInputSchema)
		.output(updateEmbeddingSettingsResponseSchema),
	embeddingProgress: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/settings/embeddings/progress",
				summary:
					"Count the files embedded, waiting and failed per organisation",
				tags,
			}),
		)
		.input(findEmbeddingProgressInputSchema)
		.output(findEmbeddingProgressResponseSchema),
	reembedEmbeddings: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/settings/embeddings/reembed",
				summary: "Embed every file again with the current setup",
				tags,
				description:
					"Starts a new collection, which search uses at once. Does nothing when the given generation is no longer active.",
			}),
		)
		.input(reembedEmbeddingsInputSchema)
		.output(reembedEmbeddingsResponseSchema),
	retryFailedEmbeddings: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/settings/embeddings/retry-failed",
				summary: "Embed the failed files again",
				tags,
			}),
		)
		.input(retryFailedEmbeddingsInputSchema)
		.output(retryFailedEmbeddingsResponseSchema),
};
