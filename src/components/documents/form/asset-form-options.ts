import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import { type Asset, assetUpdateSchema } from "@/lib/orpc/schemas/asset";

const defaultValues = (asset: Asset): z.input<typeof assetUpdateSchema> => ({
	id: asset.id,
	title: asset?.title ?? undefined,
	metadata: {
		citation: asset.metadata?.citation ?? undefined,
		externalUrl: asset.metadata?.externalUrl ?? undefined,
		relevance: asset.metadata?.relevance ?? "medium",
		showReference: asset.metadata?.showReference ?? true,
		pageRange: asset.metadata?.pageRange ?? undefined,
		author: asset.metadata?.author ?? undefined,
		chapterTitle: asset.metadata?.chapterTitle ?? undefined,
		mergePages: asset.metadata?.mergePages ?? true,
	},
});

export const assetFormOptions = (asset: Asset) =>
	formOptions({
		defaultValues: defaultValues(asset),
		validators: {
			onChange: assetUpdateSchema,
		},
	});
