import {
	discoverEmbeddingModelsInputSchema,
	discoverEmbeddingModelsResponseSchema,
	findEmbeddingProgressInputSchema,
	findEmbeddingProgressResponseSchema,
	findEmbeddingsStatusInputSchema,
	findEmbeddingsStatusResponseSchema,
	findInstanceSettingsInputSchema,
	findInstanceSettingsResponseSchema,
	prepareAssetsAgainInputSchema,
	prepareAssetsAgainResponseSchema,
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
					"Whether embeddings are set up and whether assets are being re-embedded",
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
					"Runs a test embedding first and stores nothing when it fails. The dimensions come from its result. Without an API key, the stored one is kept. Another model, another size or another passage prefix re-embeds every asset into a new collection and needs `reembedGeneration`. Another query prefix applies at once.",
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
					"Count the assets embedded, waiting and failed per organisation",
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
				summary: "Embed every asset again with the current setup",
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
				summary: "Embed the failed assets again",
				tags,
			}),
		)
		.input(retryFailedEmbeddingsInputSchema)
		.output(retryFailedEmbeddingsResponseSchema),
	prepareAssetsAgain: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/settings/embeddings/prepare-again",
				summary: "Prepare assets again",
				tags,
				description:
					"Starts queueing assets once to be prepared again, in the background, as an activity run of the caller, and returns how many there are and the run. Scope `missing` takes each asset whose failed embedding misses its stored extraction, `all` every ready asset. Preparing reads the file again, describes its images and embeds it again. Model calls are metered to each asset's uploader and still run when the uploader's quota is used up. Assets already being prepared are skipped, and a request while a run of the same scope is queued or running joins that run.",
			}),
		)
		.input(prepareAssetsAgainInputSchema)
		.output(prepareAssetsAgainResponseSchema),
};
