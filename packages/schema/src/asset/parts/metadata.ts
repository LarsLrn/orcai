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

export const MAX_DESCRIPTION_LENGTH = 300;

/** The canonical form of a BCP 47 language tag, or undefined when it is none. */
export const languageTag = (tag: string) => {
	try {
		return Intl.getCanonicalLocales(tag)[0];
	} catch {
		return undefined;
	}
};

export const metadataSchema = z.object({
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
	/** Two or three sentences on what the asset is about. */
	description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
	/** BCP 47 tag of the asset's language; empty clears it. */
	language: z
		.string()
		.refine((tag) => tag === "" || languageTag(tag) !== undefined, {
			message: "Not a BCP 47 language tag",
		})
		.optional(),
});

export type AssetMetadataType = z.infer<typeof metadataSchema>;

/** Fields that hold whatever the source type is. */
const TYPE_INDEPENDENT_FIELDS = [
	"sourceType",
	"description",
	"language",
	"externalUrl",
] as const satisfies readonly (keyof AssetMetadataType)[];

/** The fields each source type has, as the editor shows them. */
export const SOURCE_TYPE_FIELDS = {
	book: [
		"author",
		"citation",
		"chapterTitle",
		"pageRange",
	],
	"journal-article": [
		"author",
		"citation",
		"journalName",
		"volume",
		"issueNumber",
		"pageRange",
		"doi",
	],
	"web-source": [
		"author",
		"citation",
		"websiteName",
		"accessDate",
	],
	"legal-text": [
		"citation",
		"legalReference",
		"jurisdiction",
	],
} as const satisfies Record<SourceType, readonly (keyof AssetMetadataType)[]>;

/** Drops the fields its source type does not have; untyped metadata keeps all. */
export const fitMetadataToSourceType = (
	metadata: AssetMetadataType,
): AssetMetadataType => {
	if (!metadata.sourceType) {
		return metadata;
	}
	const kept = new Set<string>([
		...TYPE_INDEPENDENT_FIELDS,
		...SOURCE_TYPE_FIELDS[metadata.sourceType],
	]);
	return Object.fromEntries(
		Object.entries(metadata).filter(([field]) => kept.has(field)),
	) as AssetMetadataType;
};

/** What the utility model suggests for an asset, kept until applied or dismissed. */
export const metadataSuggestionSchema = z.object({
	title: z.string().optional(),
	metadata: metadataSchema,
});

export type MetadataSuggestion = z.infer<typeof metadataSuggestionSchema>;
