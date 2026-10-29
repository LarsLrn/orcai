import {
	type AssetMetadataType,
	fitMetadataToSourceType,
	type MetadataSuggestion,
} from "./metadata";

/** A field a metadata generation can fill. */
export type AppliedMetadataField = "title" | keyof AssetMetadataType;

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
	/** The fields whose value it changed. */
	filled: AppliedMetadataField[];
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

	const fitted = fitMetadataToSourceType(metadata);
	const keys = new Set([
		...Object.keys(target.metadata),
		...Object.keys(fitted),
	] as (keyof AssetMetadataType)[]);

	return {
		title,
		metadata: fitted,
		filled: [
			...(title === target.title
				? []
				: [
						"title" as const,
					]),
			...[
				...keys,
			].filter((field) => target.metadata[field] !== fitted[field]),
		],
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
	/** Accepted unless the field already holds a value, or needs a source type change that is not. */
	accept: boolean;
	/** Formatted for the suggested source type, which the suggestion changes: usable only with it. */
	requiresType?: true;
}

/**
 * The fields a suggestion would change, title first, in the editor's order.
 * When it changes the source type, its type-specific fields depend on that
 * change.
 */
export const metadataReviewFields = (
	current: {
		title: string;
		metadata: AssetMetadataType;
	},
	suggestion: MetadataSuggestion,
): MetadataReviewField[] => {
	const currentType = current.metadata.sourceType;
	const suggestedType = suggestion.metadata.sourceType;
	const typeChanges =
		suggestedType !== undefined && suggestedType !== currentType;
	const field = (
		name: MetadataReviewField["field"],
		currentValue: string | undefined,
		suggested: string | undefined,
	): MetadataReviewField[] => {
		if (
			suggested === undefined ||
			isEmpty(suggested) ||
			suggested === (currentValue ?? "")
		) {
			return [];
		}
		const requiresType =
			typeChanges &&
			name !== "title" &&
			name !== "sourceType" &&
			!SHARED_FIELDS.has(name);
		return [
			{
				field: name,
				current: currentValue ?? "",
				suggested,
				accept:
					isEmpty(currentValue) && (!requiresType || isEmpty(currentType)),
				...(requiresType && {
					requiresType: true as const,
				}),
			},
		];
	};

	// Only fields the resulting source type has; a save drops the others.
	const fitting = fitMetadataToSourceType({
		...suggestion.metadata,
		sourceType: suggestedType ?? currentType,
	});

	return [
		...field("title", current.title, suggestion.title),
		...field("sourceType", currentType, suggestedType),
		...suggestedFields({
			metadata: fitting,
		}).flatMap((name) =>
			field(name, current.metadata[name], suggestion.metadata[name]),
		),
	];
};

/** The accepted fields that can go into the form: type-specific ones only with their source type. */
export const acceptedReviewFields = (
	fields: readonly MetadataReviewField[],
	accepted: ReadonlySet<MetadataReviewField["field"]>,
) =>
	fields.filter(
		(field) =>
			accepted.has(field.field) &&
			(!field.requiresType || accepted.has("sourceType")),
	);
