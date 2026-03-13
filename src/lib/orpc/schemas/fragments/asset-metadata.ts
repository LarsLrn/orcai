import { z } from "zod/v4";

export const metadataSchema = z.object({
	showReference: z.boolean(),
	relevance: z.enum([
		"high",
		"medium",
		"low",
	]),
	citation: z.string().optional(),
	externalUrl: z.string().optional(),
	pageRange: z.string().optional(),
	author: z.string().optional(),
	chapterTitle: z.string().optional(),
});

export type AssetMetadataType = z.infer<typeof metadataSchema>;
