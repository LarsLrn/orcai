import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";
import type { Asset } from "@/lib/orpc/schemas/asset";
import {
	type DatabaseBlock,
	databaseBlockInsertSchema,
} from "@/lib/orpc/schemas/block";

const databaseBlockFormSchema = databaseBlockInsertSchema.extend({
	description: z.string(),
	contentHtml: z.string(),
	config: databaseBlockInsertSchema.shape.config.extend({
		scoreThreshold: z.number().min(0).max(1),
		retrievalMode: z.enum([
			"dense",
			"hybrid",
		]),
		candidateLimit: z.number().int().min(1).max(200),
		maxPerAsset: z.number().int().min(1),
	}),
});

const defaultValues = (
	block?: DatabaseBlock,
	assetIds?: Asset["id"][],
): z.input<typeof databaseBlockFormSchema> => ({
	name: block?.name || "",
	description: block?.description ?? "",
	contentJson: block?.contentJson ?? null,
	contentHtml: block?.contentHtml ?? "",
	type: "database",
	status: block?.status || "draft",
	config: {
		maxReferences: block?.config.maxReferences ?? 8,
		minReferences: block?.config.minReferences ?? 1,
		defaultReferences: block?.config.defaultReferences ?? 4,
		retrievalMode: block?.config.retrievalMode ?? "hybrid",
		scoreThreshold: block?.config.scoreThreshold ?? 0.2,
		candidateLimit: block?.config.candidateLimit ?? 40,
		maxPerAsset: block?.config.maxPerAsset ?? 6,
	},
	assets: assetIds || [],
});

export const databaseBlockFormOptions = (
	block?: DatabaseBlock,
	assetIds?: Asset["id"][],
) =>
	formOptions({
		defaultValues: defaultValues(block, assetIds),
		validators: {
			onChange: databaseBlockFormSchema,
		},
	});
