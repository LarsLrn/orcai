import { clamp } from "effect/Number";
import { tokenize } from "@/lib/utils/text-utils";

/**
 * Determines the minimum cosine-similarity score a Qdrant result must
 * reach to be considered relevant.
 *
 * - If the caller supplies an explicit threshold it is used directly
 *   (clamped to [0, 1]).
 * - Otherwise a heuristic is applied: shorter queries (≤3 tokens) get a
 *   lower threshold (0.35) to increase recall, while longer, more specific
 *   queries get a stricter threshold (up to 0.50) to maintain precision.
 *
 * @param params.explicit - Optional caller-supplied override.
 * @param params.queries  - The raw query strings (used only when no
 *                          explicit threshold is given).
 */
export const resolveScoreThreshold = (params: {
	explicit?: number;
	queries?: string[];
}): number => {
	if (params.explicit !== undefined) {
		return clamp(params.explicit, {
			maximum: 1,
			minimum: 0,
		});
	}

	const thresholds = params.queries?.map((query) => {
		const tokenCount = tokenize(query).length;
		if (tokenCount <= 3) return 0.35; // Short query — favour recall.
		if (tokenCount <= 8) return 0.42; // Medium query — balanced.
		return 0.5; // Long query — favour precision.
	});

	if (!thresholds || thresholds?.length === 0) {
		return 0.42; // Default to balanced if empty array provided.
	}

	return Math.max(...thresholds);
};
