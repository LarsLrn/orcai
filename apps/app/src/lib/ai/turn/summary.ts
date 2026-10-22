import { COMPACTION_INSTRUCTIONS } from "@orcai/ai";
import { getToolName, isToolUIPart } from "ai";
import * as Effect from "effect/Effect";
import { generateTextWithQuota } from "@/lib/ai/effects/generate-text-with-quota";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import type { TurnRequester, TurnSetup } from "./setup";

/** Summaries stay short; the conversation goes on from them. */
const SUMMARY_MAX_OUTPUT_TOKENS = 8_192;

const partLine = (part: ChatAgentUIMessage["parts"][number]) => {
	if (part.type === "text") {
		return part.text;
	}
	if (part.type === "file") {
		return `[File: ${part.filename ?? part.mediaType}]`;
	}
	if (!isToolUIPart(part)) {
		return undefined;
	}
	const call = `[Tool ${getToolName(part)} called with ${JSON.stringify(part.input ?? {})}`;
	switch (part.state) {
		case "output-available":
			return `${call}, returned ${JSON.stringify(part.output)}]`;
		case "output-error":
			return `${call}, failed: ${part.errorText}]`;
		case "output-denied":
			return `${call}, denied by the user]`;
		default:
			return `${call}, without a result]`;
	}
};

/** The conversation as plain text, so the summary request carries no tool calls of its own. */
const transcript = (messages: readonly ChatAgentUIMessage[]) =>
	messages
		.map((message) =>
			[
				message.role === "user" ? "User:" : "Assistant:",
				...message.parts.flatMap((part) => partLine(part) ?? []),
			].join("\n"),
		)
		.join("\n\n");

/**
 * Our own summary of `history` on the turn's model, metered as a call of its
 * own; undefined when it fails or comes back empty.
 */
export const summarizeHistory = ({
	setup,
	requester,
	replyId,
	history,
	stop,
}: {
	setup: TurnSetup;
	requester: TurnRequester;
	replyId: string;
	history: readonly ChatAgentUIMessage[];
	stop: AbortSignal | undefined;
}) => {
	const prompt = transcript(history);
	return generateTextWithQuota({
		operation: "chatTurn.compact",
		appRequestId: `compaction:${replyId}`,
		organizationId: requester.organizationId,
		userId: requester.user.id,
		providerId: setup.providerId,
		modelId: setup.modelId,
		botId: setup.botId,
		model: setup.model.language,
		system: COMPACTION_INSTRUCTIONS,
		prompt,
		reservationMessages: [
			COMPACTION_INSTRUCTIONS,
			prompt,
		],
		maxOutputTokens: Math.min(
			setup.callSettings.maxOutputTokens,
			SUMMARY_MAX_OUTPUT_TOKENS,
		),
		abortSignal: stop,
	}).pipe(
		Effect.map(({ text }) => text.trim() || undefined),
		Effect.catchCause((cause) =>
			Effect.logWarning("chat summary failed", cause).pipe(
				Effect.as(undefined),
			),
		),
	);
};
