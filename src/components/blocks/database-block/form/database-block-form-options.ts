import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import type { Asset } from "@/lib/orpc/schemas/asset";
import {
	type DatabaseBlock,
	databaseBlockInsertSchema,
} from "@/lib/orpc/schemas/block";

const defaultValues = (
	block?: DatabaseBlock,
	assetIds?: Asset["id"][],
): z.input<typeof databaseBlockInsertSchema> => ({
	name: block?.name || "",
	type: "database",
	status: block?.status || "draft",
	config: {
		provider: block?.config.provider || "",
		embeddingModel: block?.config.embeddingModel || "",
		maxReferences: block?.config.maxReferences || 10,
		minReferences: block?.config.minReferences || 1,
		defaultReferences: block?.config.defaultReferences || 5,
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
			onChange: databaseBlockInsertSchema,
		},
	});
