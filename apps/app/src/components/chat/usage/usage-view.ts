import type { QuotaStatus } from "@orcai/schema";
import { isExhaustedShare, isLowShare } from "@/lib/presentation/quota-share";

interface ContextUsage {
	tokens: number;
	/** Unknown when the model does not state its window. */
	window: number | undefined;
	share: number | undefined;
	modelName: string | undefined;
	/** Over the window, so the next turn summarises earlier messages. */
	overflowing: boolean;
}

interface PoolUsage extends NonNullable<QuotaStatus["pool"]> {
	low: boolean;
	exhausted: boolean;
}

interface UsageView {
	context: ContextUsage | undefined;
	pool: PoolUsage | undefined;
	tone: "warning" | "danger" | undefined;
}

/** The composer's usage: the newest context over the selected model's window, and its pool. */
const usageView = ({
	contextTokens,
	contextWindow,
	modelName,
	pool,
}: {
	contextTokens: number | undefined;
	contextWindow: number | null | undefined;
	modelName: string | undefined;
	pool: QuotaStatus["pool"] | undefined;
}): UsageView | undefined => {
	const window = contextWindow ?? undefined;
	const share =
		contextTokens !== undefined && window ? contextTokens / window : undefined;
	const context =
		contextTokens === undefined
			? undefined
			: {
					tokens: contextTokens,
					window,
					share,
					modelName,
					overflowing: share !== undefined && share > 1,
				};
	const poolUsage = pool
		? {
				...pool,
				low: isLowShare(pool.usedShare),
				exhausted: isExhaustedShare(pool.usedShare),
			}
		: undefined;

	if (!context && !poolUsage) return undefined;

	return {
		context,
		pool: poolUsage,
		tone: poolUsage?.exhausted
			? "danger"
			: poolUsage?.low
				? "warning"
				: undefined,
	};
};

export { type UsageView, usageView };
