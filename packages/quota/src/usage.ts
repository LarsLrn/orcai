import type { dbSchema } from "@orcai/db";

/** What one provider request used; a count the provider left out is undefined. */
export interface MeteredStep {
	inputTokens?: number;
	/** Input read neither from nor into the prompt cache. */
	noCacheInputTokens?: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
	outputTokens?: number;
	/** Already inside the output tokens. */
	reasoningTokens?: number;
	totalTokens?: number;
	/** Searches the model ran with its provider's own tool. */
	webSearches?: number;
}

type UsageEvent = typeof dbSchema.quotaUsageEvent.$inferInsert;

export type RecordedUsage = Pick<
	UsageEvent,
	| "requestCount"
	| "inputTokens"
	| "noCacheInputTokens"
	| "cacheReadTokens"
	| "cacheWriteTokens"
	| "outputTokens"
	| "reasoningTokens"
	| "totalTokens"
	| "webSearchCount"
>;

/** A token class's sum, undefined when no step reported it. */
const sumOf = (
	steps: readonly MeteredStep[],
	key: Exclude<keyof MeteredStep, "webSearches">,
) =>
	steps.reduce<number | undefined>((sum, step) => {
		const tokens = step[key];
		return tokens === undefined ? sum : (sum ?? 0) + tokens;
	}, undefined);

/** The usage event's counts for a call's steps, one provider request each. */
export const recordedUsage = (
	steps: readonly MeteredStep[],
): RecordedUsage => ({
	requestCount: steps.length,
	inputTokens: sumOf(steps, "inputTokens"),
	noCacheInputTokens: sumOf(steps, "noCacheInputTokens"),
	cacheReadTokens: sumOf(steps, "cacheReadTokens"),
	cacheWriteTokens: sumOf(steps, "cacheWriteTokens"),
	outputTokens: sumOf(steps, "outputTokens"),
	reasoningTokens: sumOf(steps, "reasoningTokens"),
	totalTokens: sumOf(steps, "totalTokens"),
	webSearchCount: steps.reduce((sum, step) => sum + (step.webSearches ?? 0), 0),
});
