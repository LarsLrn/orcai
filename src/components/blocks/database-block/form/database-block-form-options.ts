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
	description: block?.description ?? null,
	contentJson: block?.contentJson ?? null,
	contentHtml: block?.contentHtml ?? null,
	type: "database",
	status: block?.status || "draft",
	config: {
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
