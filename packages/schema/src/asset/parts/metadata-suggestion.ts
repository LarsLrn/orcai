import type { AssetMetadataType, MetadataSuggestion } from "./metadata";

type MetadataField = Exclude<keyof AssetMetadataType, "sourceType">;

/** Fields that hold whatever the source type; the rest are formatted for one source type. */
const SHARED_FIELDS = new Set<MetadataField>([
	"description",
	"language",
	"externalUrl",
]);

const isEmpty = (value: string | undefined) =>
	value === undefined || value.trim() === "";

const suggestedFields = (suggestion: MetadataSuggestion) =>
	(Object.keys(suggestion.metadata) as (keyof AssetMetadataType)[]).filter(
		(field): field is MetadataField =>
			field !== "sourceType" && !isEmpty(suggestion.metadata[field]),
	);

/** What an asset holds when a suggestion is merged into it. */
export interface MetadataTarget {
	title: string;
	/** The uploaded file's name; while the title still equals it, a suggested title replaces it. */
	fileName: string | null;
	metadata: AssetMetadataType;
}

/**
 * Fills only empty fields, and the title only while it is still the uploaded
 * file's name. A suggestion for another source type than the asset's keeps
 * its type-specific fields for review: they are formatted for that type.
 */
export const applyMetadataSuggestion = (
	target: MetadataTarget,
	suggestion: MetadataSuggestion,
): {
	title: string;
	metadata: AssetMetadataType;
	/** What is left to review; null when everything was applied or skipped. */
	review: MetadataSuggestion | null;
} => {
	const kept = target.metadata.sourceType;
	const suggestedType = suggestion.metadata.sourceType;
	const conflicting =
		kept !== undefined && suggestedType !== undefined && kept !== suggestedType;
	const metadata: AssetMetadataType = {
		...target.metadata,
	};
	const review: AssetMetadataType = {};

	if (kept === undefined && suggestedType !== undefined) {
		metadata.sourceType = suggestedType;
	}
	for (const field of suggestedFields(suggestion)) {
		const value = suggestion.metadata[field];
		if (conflicting && !SHARED_FIELDS.has(field)) {
			review[field] = value;
		} else if (isEmpty(metadata[field])) {
			metadata[field] = value;
		}
	}

	const title =
		suggestion.title &&
		target.fileName !== null &&
		target.title === target.fileName
			? suggestion.title
			: target.title;

	return {
		title,
		metadata,
		review:
			Object.keys(review).length > 0
				? {
						metadata: {
							...review,
							sourceType: suggestedType,
						},
					}
				: null,
	};
};

/** One field of a suggestion under review. */
export interface MetadataReviewField {
	field: "title" | keyof AssetMetadataType;
	current: string;
	suggested: string;
	/** Accepted unless the field already holds a value. */
	accept: boolean;
}

/** The fields a suggestion would change, title first, in the editor's order. */
export const metadataReviewFields = (
	current: {
		title: string;
		metadata: AssetMetadataType;
	},
	suggestion: MetadataSuggestion,
): MetadataReviewField[] => {
	const field = (
		name: MetadataReviewField["field"],
		currentValue: string | undefined,
		suggested: string | undefined,
	): MetadataReviewField[] =>
		suggested === undefined ||
		isEmpty(suggested) ||
		suggested === (currentValue ?? "")
			? []
			: [
					{
						field: name,
						current: currentValue ?? "",
						suggested,
						accept: isEmpty(currentValue),
					},
				];

	return [
		...field("title", current.title, suggestion.title),
		...field(
			"sourceType",
			current.metadata.sourceType,
			suggestion.metadata.sourceType,
		),
		...suggestedFields(suggestion).flatMap((name) =>
			field(name, current.metadata[name], suggestion.metadata[name]),
		),
	];
};
