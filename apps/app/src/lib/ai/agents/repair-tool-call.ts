import {
	InvalidToolInputError,
	type JSONSchema7,
	type ToolCallRepairFunction,
	type ToolSet,
} from "ai";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const parseToolInput = (input: string) => {
	try {
		const parsed = JSON.parse(input);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

/** The bounds the tool's input schema sets on a property. */
type Limits = (property: string) => {
	min: number;
	max: number;
	maxItems: number;
};

const limitsOf =
	(schema: JSONSchema7): Limits =>
	(property) => {
		const definition = schema.properties?.[property];
		const bounds = typeof definition === "object" ? definition : {};
		return {
			min: bounds.minimum ?? Number.MIN_SAFE_INTEGER,
			max: bounds.maximum ?? Number.MAX_SAFE_INTEGER,
			maxItems: bounds.maxItems ?? Number.MAX_SAFE_INTEGER,
		};
	};

const clampInteger = (
	value: unknown,
	{
		min,
		max,
	}: {
		min: number;
		max: number;
	},
) => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}

	return Math.min(max, Math.max(min, Math.trunc(value)));
};

const normalizeTrimmedString = (value: unknown) => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStringArray = (value: unknown, maxItems: number) => {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const normalized = value
		.map(normalizeTrimmedString)
		.filter((item): item is string => item !== undefined);

	return normalized.length > 0 ? normalized.slice(0, maxItems) : [];
};

const repairSearchRepositoriesInput = (
	input: Record<string, unknown>,
	limits: Limits,
) => {
	const maxVariants = limits("queryVariants").maxItems;
	const query = normalizeTrimmedString(input.query);
	// Cut after a variant is promoted to the query, so the rest keep their room.
	const queryVariants = normalizeStringArray(
		input.queryVariants,
		Number.POSITIVE_INFINITY,
	);

	const normalizedAssetIds = normalizeStringArray(
		input.assetIds,
		limits("assetIds").maxItems,
	);
	const blockId = normalizeTrimmedString(input.blockId);

	const normalizedQuery = query ?? queryVariants?.[0];

	const normalizedVariants = (queryVariants ?? [])
		.slice(query ? 0 : 1)
		.filter((variant) => variant !== normalizedQuery);

	return {
		...(normalizedQuery
			? {
					query: normalizedQuery,
				}
			: {}),
		...(normalizedVariants.length > 0
			? {
					queryVariants: normalizedVariants.slice(0, maxVariants),
				}
			: {}),
		...(normalizedAssetIds && normalizedAssetIds.length > 0
			? {
					assetIds: normalizedAssetIds,
				}
			: {}),
		...(blockId
			? {
					blockId,
				}
			: {}),
	};
};

const repairGetPassagesInput = (
	input: Record<string, unknown>,
	limits: Limits,
) => {
	const passages = normalizeStringArray(
		input.passages,
		limits("passages").maxItems,
	);
	const neighbours = clampInteger(input.neighbours, limits("neighbours"));

	return {
		passages: passages ?? [],
		...(typeof neighbours === "number"
			? {
					neighbours,
				}
			: {}),
	};
};

const repairGetAssetPageInput = (
	input: Record<string, unknown>,
	limits: Limits,
) => {
	const page = clampInteger(input.page ?? input.pageNumber, limits("page"));
	const limit = clampInteger(input.limit, limits("limit"));
	const includeAdjacentPages = clampInteger(
		input.includeAdjacentPages,
		limits("includeAdjacentPages"),
	);

	const assetId =
		normalizeTrimmedString(input.assetId) ??
		normalizeTrimmedString(input.asset_id);
	const blockId = normalizeTrimmedString(input.blockId);
	const assetTitleQuery = normalizeTrimmedString(input.assetTitleQuery);

	return {
		...(typeof page === "number"
			? {
					page,
				}
			: {
					page: 1,
				}),
		...(typeof limit === "number"
			? {
					limit,
				}
			: {}),
		...(typeof includeAdjacentPages === "number"
			? {
					includeAdjacentPages,
				}
			: {}),
		...(assetId
			? {
					assetId,
				}
			: {}),
		...(blockId
			? {
					blockId,
				}
			: {}),
		...(assetTitleQuery
			? {
					assetTitleQuery,
				}
			: {}),
	};
};

const repairListRepositoryAssetsInput = (
	input: Record<string, unknown>,
	limits: Limits,
) => {
	const query = normalizeTrimmedString(input.query);
	const blockId = normalizeTrimmedString(input.blockId);
	const limit = clampInteger(input.limit, limits("limit"));

	return {
		...(query
			? {
					query,
				}
			: {}),
		...(blockId
			? {
					blockId,
				}
			: {}),
		...(typeof limit === "number"
			? {
					limit,
				}
			: {}),
	};
};

const repairers: Record<
	string,
	(input: Record<string, unknown>, limits: Limits) => Record<string, unknown>
> = {
	searchRepositories: repairSearchRepositoriesInput,
	getPassages: repairGetPassagesInput,
	getAssetPage: repairGetAssetPageInput,
	listRepositoryAssets: repairListRepositoryAssetsInput,
};

/**
 * Repairs repository tool input within the bounds of the tool's schema; other
 * calls are left as they are. The SDK validates the repaired input again, and
 * one that still fails becomes a tool error for the model.
 */
export const repairRepositoryToolCall: ToolCallRepairFunction<
	ToolSet
> = async ({ toolCall, error, inputSchema }) => {
	const repairer = Object.hasOwn(repairers, toolCall.toolName)
		? repairers[toolCall.toolName]
		: undefined;
	if (!repairer || !InvalidToolInputError.isInstance(error)) {
		return null;
	}

	const parsedInput = parseToolInput(toolCall.input);
	if (!parsedInput) {
		return null;
	}

	return {
		...toolCall,
		input: JSON.stringify(
			repairer(
				parsedInput,
				limitsOf(
					await inputSchema({
						toolName: toolCall.toolName,
					}),
				),
			),
		),
	};
};
