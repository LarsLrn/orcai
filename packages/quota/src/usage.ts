import type { dbSchema } from "@orcai/db";
import * as Schema from "effect/Schema";

const count = Schema.optional(Schema.Number);

/** What one provider request used; a count the provider left out is undefined. */
export const MeteredStep = Schema.Struct({
	inputTokens: count,
	/** Input read neither from nor into the prompt cache. */
	noCacheInputTokens: count,
	cacheReadTokens: count,
	cacheWriteTokens: count,
	outputTokens: count,
	/** Already inside the output tokens. */
	reasoningTokens: count,
	totalTokens: count,
	/** Searches the model ran with its provider's own tool. */
	webSearches: count,
	/** The cost the provider reported for the request, in USD. */
	reportedCost: count,
});

export type MeteredStep = typeof MeteredStep.Type;

type UsageEvent = typeof dbSchema.quotaUsageEvent.$inferInsert;

export type UsageCounts = Pick<
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
	key: Exclude<keyof MeteredStep, "webSearches" | "reportedCost">,
) =>
	steps.reduce<number | undefined>((sum, step) => {
		const tokens = step[key];
		return tokens === undefined ? sum : (sum ?? 0) + tokens;
	}, undefined);

/** The usage event's counts for a call's steps, one provider request each. */
export const usageCounts = (steps: readonly MeteredStep[]): UsageCounts => ({
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
