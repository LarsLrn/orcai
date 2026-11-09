import type { ChatMessageId } from "@orcai/core";
import type {
	ChatMessageAttachment,
	ChatMessageMetadata,
	ChatMessagePart,
} from "@orcai/schema";
import {
	getStaticToolName,
	type InferUITools,
	isStaticToolUIPart,
	type UIMessage,
} from "ai";
import type { AssistantTools } from "@/lib/ai/agents/assistant-agent";
import type { ChatTools } from "@/lib/ai/agents/chat-agent";
import { toolDeclarationOf } from "@/lib/ai/tools/registry";

/** The tools of both chat kinds, so one message type covers plain, bot and assistant chats. */
export type ChatAgentTools = ChatTools & AssistantTools;

export type ChatAgentUIMessage = Omit<
	UIMessage<ChatMessageMetadata, never, InferUITools<ChatAgentTools>>,
	"id"
> & {
	id: ChatMessageId;
	attachments?: ChatMessageAttachment[];
};

type Part = UIMessage["parts"][number];

const OPEN_STATES = new Set([
	"input-available",
	"approval-requested",
	"approval-responded",
]);
const SETTLED_STATES = new Set([
	"output-available",
	"output-denied",
]);

/**
 * A call of a declared tool whose input no longer fits, as the model can read
 * it: an open call fails with INVALID_TOOL_INPUT, and a settled one, like one
 * whose client answer does not fit, keeps its result as an untyped call.
 */
const fitToItsTool = (part: Part): Part => {
	if (!isStaticToolUIPart(part)) {
		return part;
	}
	const toolName = getStaticToolName(part);
	const declaration = toolDeclarationOf(toolName);
	const open = OPEN_STATES.has(part.state);
	if (!declaration || !(open || SETTLED_STATES.has(part.state))) {
		return part;
	}

	const input = declaration.inputSchema.safeParse(part.input);
	if (!input.success && open) {
		const { approval: _, ...call } = part;
		return {
			...call,
			state: "output-error",
			errorText: `INVALID_TOOL_INPUT: Invalid input for tool ${toolName}: ${input.error.message}`,
		} as Part;
	}

	const fits =
		input.success &&
		!(
			part.state === "output-available" &&
			declaration.kind === "client" &&
			declaration.outputSchema?.safeParse(part.output).success === false
		);
	if (fits) {
		return part;
	}
	const { type: _, ...call } = part;
	return {
		...call,
		type: "dynamic-tool",
		toolName,
	} as Part;
};

/**
 * Read parts as the chat's UI parts. A declared tool's call that does not fit
 * its tool is closed or untyped, so a typed call's input, and a client call's
 * answer, always fit their schemas.
 */
export const toChatAgentParts = (parts: readonly ChatMessagePart[]) => {
	const fitted = (parts as Part[]).map(fitToItsTool);
	return (
		fitted.some((part, index) => part !== parts[index]) ? fitted : parts
	) as ChatAgentUIMessage["parts"];
};

/** Messages with read parts, as the chat's UI messages. */
export const toChatAgentMessages = (
	messages: readonly {
		id: ChatMessageId;
		role: string;
		parts: readonly ChatMessagePart[];
		metadata: ChatMessageMetadata;
		attachments?: ChatMessageAttachment[];
	}[],
): ChatAgentUIMessage[] =>
	messages.map(
		({ id, role, parts, metadata, attachments }) =>
			({
				id,
				role,
				parts: toChatAgentParts(parts),
				metadata,
				attachments,
			}) as ChatAgentUIMessage,
	);
