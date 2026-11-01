import type { AssetId } from "@orcai/core";
import {
	createRepositoryInputSchema,
	type Repository,
	retrievalModeSchema,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

const repositoryFormSchema = createRepositoryInputSchema.extend({
	description: z.string(),
	config: createRepositoryInputSchema.shape.config.extend({
		scoreThreshold: z.number().min(0).max(1),
		retrievalMode: retrievalModeSchema,
		candidateLimit: z.number().int().min(1).max(200),
		maxPerAsset: z.number().int().min(1),
	}),
});

const defaultValues = (
	block?: Repository,
	assetIds?: AssetId[],
): z.input<typeof repositoryFormSchema> => ({
	name: block?.name || "",
	description: block?.description ?? "",
	contentJson: block?.contentJson ?? null,
	type: "repository",
	status: block?.status || "draft",
	config: {
		maxPassages: block?.config.maxPassages ?? 8,
		minPassages: block?.config.minPassages ?? 1,
		defaultPassages: block?.config.defaultPassages ?? 4,
		retrievalMode: block?.config.retrievalMode ?? "hybrid",
		scoreThreshold: block?.config.scoreThreshold ?? 0.2,
		candidateLimit: block?.config.candidateLimit ?? 40,
		maxPerAsset: block?.config.maxPerAsset ?? 6,
	},
	assets: assetIds || [],
	uploadRunIds: [],
});

export const repositoryFormOptions = (
	block?: Repository,
	assetIds?: AssetId[],
) =>
	formOptions({
		defaultValues: defaultValues(block, assetIds),
		validators: {
			onChange: repositoryFormSchema,
		},
	});
