import { z } from "zod/v4";

export const sourceTypes = [
	"book",
	"journal-article",
	"web-source",
	"legal-text",
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const sourceTypeLabels: Record<SourceType, string> = {
	book: "Book",
	"journal-article": "Journal Article",
	"web-source": "Web Source",
	"legal-text": "Legal Text",
};

export const metadataSchema = z.object({
	showReference: z.boolean(),
	relevance: z.enum([
		"high",
		"medium",
		"low",
	]),
	sourceType: z.enum(sourceTypes).optional(),
	citation: z.string().optional(),
	externalUrl: z.string().optional(),
	pageRange: z.string().optional(),
	author: z.string().optional(),
	chapterTitle: z.string().optional(),
	journalName: z.string().optional(),
	volume: z.string().optional(),
	issueNumber: z.string().optional(),
	doi: z.string().optional(),
	websiteName: z.string().optional(),
	accessDate: z.string().optional(),
	legalReference: z.string().optional(),
	jurisdiction: z.string().optional(),
});

export type AssetMetadataType = z.infer<typeof metadataSchema>;
