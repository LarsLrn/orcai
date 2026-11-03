import type { MeteredStep } from "@orcai/quota";
import type { StepResult, ToolSet } from "ai";
import { z } from "zod/v4";
import { NATIVE_WEB_SEARCH_TOOL_NAME } from "../provider-kinds/registry";

/** What metering reads of a finished provider request. */
export type MeterStep = Pick<StepResult<ToolSet>, "usage" | "toolCalls">;

/** What metering reads of a provider's own usage report. */
const rawUsageSchema = z
	.object({
		server_tool_use: z
			.object({
				web_search_requests: z.number(),
			})
			.optional()
			.catch(undefined),
		/** OpenRouter's cost of the request, in credits of one USD. */
		cost: z.number().nonnegative().optional().catch(undefined),
	})
	.catch({});

/** A finished SDK step as the quota charges it. */
export const meteredStep = ({ usage, toolCalls }: MeterStep): MeteredStep => {
	const raw = rawUsageSchema.parse(usage.raw);
	return {
		inputTokens: usage.inputTokens,
		noCacheInputTokens: usage.inputTokenDetails.noCacheTokens,
		cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
		cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
		outputTokens: usage.outputTokens,
		reasoningTokens: usage.outputTokenDetails.reasoningTokens,
		totalTokens: usage.totalTokens,
		// Anthropic counts native searches in its usage; OpenAI only returns their calls.
		webSearches:
			raw.server_tool_use?.web_search_requests ??
			toolCalls.filter(
				(call) =>
					call.providerExecuted === true &&
					call.toolName === NATIVE_WEB_SEARCH_TOOL_NAME,
			).length,
		reportedCost: raw.cost,
	};
};
