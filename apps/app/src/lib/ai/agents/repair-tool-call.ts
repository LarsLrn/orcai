import type { NATIVE_WEB_SEARCH_TOOL_NAME } from "@orcai/ai";
import type { Tool } from "ai";
import {
	InvalidToolInputError,
	NoSuchToolError,
	type ToolCallRepairFunction,
} from "ai";
import type { GenUiTools } from "@/components/chat/gen-ui/catalog";
import type { QuestionTools } from "@/lib/ai/tools/questions/toolset";
import type { buildKnowledgeBaseTools } from "@/lib/ai/tools/rag/toolset";
import type { searchWebTool } from "@/lib/ai/tools/web/search-web";
import { RETRIEVAL_LIMITS } from "@/settings/constants";

export type ChatAgentTools = ReturnType<typeof buildKnowledgeBaseTools> &
	GenUiTools &
	QuestionTools & {
		searchWeb: ReturnType<typeof searchWebTool>;
		/** Provider-executed: its input and output differ by provider. */
		[NATIVE_WEB_SEARCH_TOOL_NAME]: Tool;
	};

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

const clampInteger = ({
	value,
	min,
	max,
}: {
	value: unknown;
	min: number;
	max: number;
}) => {
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

const repairSearchKnowledgeBaseInput = (input: Record<string, unknown>) => {
	const query = normalizeTrimmedString(input.query);
	const queryVariants = normalizeStringArray(input.queryVariants, 4);

	const normalizedAssetIds = normalizeStringArray(input.assetIds, 20);
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
					queryVariants: normalizedVariants.slice(0, 4),
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

const repairGetKnowledgeBaseChunksInput = (input: Record<string, unknown>) => {
	const chunks = normalizeStringArray(
		input.chunks,
		RETRIEVAL_LIMITS.maxFullChunkFetches,
	);
	const neighbours = clampInteger({
		value: input.neighbours,
		min: 0,
		max: 2,
	});

	return {
		chunks: chunks ?? [],
		...(typeof neighbours === "number"
			? {
					neighbours,
				}
			: {}),
	};
};

const repairGetKnowledgeBasePageInput = (input: Record<string, unknown>) => {
	const page = clampInteger({
		value: input.page ?? input.pageNumber,
		min: 1,
		max: Number.MAX_SAFE_INTEGER,
	});
	const limit = clampInteger({
		value: input.limit,
		min: 1,
		max: 30,
	});
	const includeAdjacentPages = clampInteger({
		value: input.includeAdjacentPages,
		min: 0,
		max: 2,
	});

	const assetId =
		normalizeTrimmedString(input.assetId) ??
		normalizeTrimmedString(input.asset_id);
	const blockId = normalizeTrimmedString(input.blockId);
	const documentTitleQuery = normalizeTrimmedString(input.documentTitleQuery);

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
		...(documentTitleQuery
			? {
					documentTitleQuery,
				}
			: {}),
	};
};

const repairListKnowledgeBaseDocumentsInput = (
	input: Record<string, unknown>,
) => {
	const query = normalizeTrimmedString(input.query);
	const blockId = normalizeTrimmedString(input.blockId);
	const limit = clampInteger({
		value: input.limit,
		min: 1,
		max: 100,
	});

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

const repairToolInput = ({
	toolName,
	input,
}: {
	toolName: string;
	input: Record<string, unknown>;
}) => {
	switch (toolName) {
		case "searchKnowledgeBase":
			return repairSearchKnowledgeBaseInput(input);
		case "getKnowledgeBaseChunks":
			return repairGetKnowledgeBaseChunksInput(input);
		case "getKnowledgeBasePage":
			return repairGetKnowledgeBasePageInput(input);
		case "listKnowledgeBaseDocuments":
			return repairListKnowledgeBaseDocumentsInput(input);
		default:
			return null;
	}
};

/** Repairs knowledge-base tool input only; other calls are left as they are. */
export const repairKnowledgeBaseToolCall: ToolCallRepairFunction<
	ChatAgentTools
> = ({ toolCall, error }) => {
	if (NoSuchToolError.isInstance(error)) {
		return Promise.resolve(null);
	}

	if (!InvalidToolInputError.isInstance(error)) {
		return Promise.resolve(null);
	}

	const parsedInput = parseToolInput(toolCall.input);
	if (!parsedInput) {
		return Promise.resolve(null);
	}

	const repairedInput = repairToolInput({
		toolName: toolCall.toolName,
		input: parsedInput,
	});

	if (!repairedInput) {
		return Promise.resolve(null);
	}

	return Promise.resolve({
		...toolCall,
		input: JSON.stringify(repairedInput),
	});
};
