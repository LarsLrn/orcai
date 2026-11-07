import type { ModelProviderKind } from "@orcai/core";
import type { CallSpec } from "./call-spec";
import { COMPACTION_INSTRUCTIONS } from "./provider-kinds/compaction";
import { callProviderOptions } from "./provider-kinds/registry";

/** Summaries stay short; the conversation goes on from them. */
const SUMMARY_MAX_OUTPUT_TOKENS = 8_192;

/** Our own summary of a conversation written out as `transcript`, within the turn's output cap. */
export const summaryCall = (
	kind: ModelProviderKind,
	{
		transcript,
		turnMaxOutputTokens,
	}: {
		transcript: string;
		turnMaxOutputTokens: number;
	},
): CallSpec => ({
	operation: "chatTurn.compact",
	instructions: COMPACTION_INSTRUCTIONS,
	prompt: transcript,
	maxOutputTokens: Math.min(turnMaxOutputTokens, SUMMARY_MAX_OUTPUT_TOKENS),
	providerOptions: callProviderOptions(kind),
});
