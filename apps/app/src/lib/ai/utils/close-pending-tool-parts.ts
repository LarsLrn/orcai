import {
	mergeReadableParts,
	readableChatMessageParts,
	type StoredChatMessageParts,
} from "@orcai/schema";
import { getToolName, isToolUIPart, type ToolSet, type UIMessage } from "ai";
import { isConversationalTool } from "@/lib/ai/tools/registry";
import { toChatAgentParts } from "@/lib/ai/types/chat-agent-message";

/** Why a pending call was closed, as the sentence the model reads for it. */
export const TOOL_CLOSE_SENTENCES = {
	superseded: "Not run: the user sent a new message instead.",
	declined:
		"Not answered: the user skipped the questions and sent a new message instead, which is their reply.",
	interrupted:
		"Not completed: the turn was interrupted. If the call changes something, it may have been applied; check before retrying.",
} as const;

export type ToolCloseCode = keyof typeof TOOL_CLOSE_SENTENCES;

/** The close code a stored error text or denial reason carries, if any. */
export const toolCloseCode = (
	text: string | undefined,
): ToolCloseCode | undefined =>
	(Object.keys(TOOL_CLOSE_SENTENCES) as ToolCloseCode[]).find(
		(code) => TOOL_CLOSE_SENTENCES[code] === text,
	);

type Part = UIMessage["parts"][number];

const isClientTool = (
	part: Parameters<typeof getToolName>[0],
	tools: ToolSet,
) => {
	const tool = tools[getToolName(part)];

	return tool !== undefined && tool.execute === undefined;
};

const closeRunningPart = (part: Part, tools: ToolSet): Part => {
	if (!isToolUIPart(part)) {
		return part;
	}

	switch (part.state) {
		case "input-available":
			return isClientTool(part, tools)
				? part
				: {
						...part,
						state: "output-error",
						errorText: TOOL_CLOSE_SENTENCES.interrupted,
					};
		case "input-streaming":
			return {
				...part,
				state: "output-error",
				input: part.input ?? {},
				errorText: TOOL_CLOSE_SENTENCES.interrupted,
			};
		default:
			return part;
	}
};

const closePart = (part: Part, tools: ToolSet): Part => {
	if (!isToolUIPart(part)) {
		return part;
	}

	switch (part.state) {
		case "approval-requested":
			return {
				...part,
				state: "output-denied",
				approval: {
					...part.approval,
					approved: false,
					reason: TOOL_CLOSE_SENTENCES.superseded,
				},
			};
		case "approval-responded":
			// An answered call that never ran stays unrun; a denial keeps the user's reason.
			return {
				...part,
				state: "output-denied",
				approval: {
					...part.approval,
					approved: false,
					...(part.approval.approved
						? {
								reason: TOOL_CLOSE_SENTENCES.superseded,
							}
						: {}),
				},
			};
		case "input-available":
			return isClientTool(part, tools)
				? {
						...part,
						state: "output-error",
						errorText:
							TOOL_CLOSE_SENTENCES[
								isConversationalTool(getToolName(part))
									? "declined"
									: "superseded"
							],
					}
				: closeRunningPart(part, tools);
		default:
			return closeRunningPart(part, tools);
	}
};

/**
 * Closes the calls whose run or input a turn's end cut off; a client call
 * still waits for the browser.
 */
export const closeRunningToolParts = (
	parts: UIMessage["parts"],
	tools: ToolSet,
) => parts.map((part) => closeRunningPart(part, tools));

/**
 * Gives every tool call still waiting for a result one, so the model can be
 * prompted with the turn again. A tool without `execute` is a client tool.
 */
export const closePendingToolParts = (
	parts: UIMessage["parts"],
	tools: ToolSet,
): {
	parts: UIMessage["parts"];
	changed: boolean;
} => {
	const closed = parts.map((part) => closePart(part, tools));

	return {
		parts: closed,
		changed: closed.some((part, index) => part !== parts[index]),
	};
};

/** Closes the pending tool calls of the last reply, which the model would reject. */
export const closeLastReply = <Message extends UIMessage>(
	history: Message[],
	tools: ToolSet,
) => {
	const lastReply = history
		.filter((message) => message.role === "assistant")
		.at(-1);
	const closed = lastReply && closePendingToolParts(lastReply.parts, tools);

	if (!lastReply || !closed?.changed) {
		return {
			closedHistory: history,
			closedReply: undefined,
		};
	}

	const closedReply = {
		...lastReply,
		parts: closed.parts as Message["parts"],
	};

	return {
		closedHistory: history.map((message) =>
			message === lastReply ? closedReply : message,
		),
		closedReply,
	};
};

/**
 * Closes the pending tool calls of copied replies, so a copy never runs one.
 * Parts this version cannot read are copied as they are.
 */
export const closeCopiedToolParts = <
	Row extends {
		role: string;
		parts: StoredChatMessageParts;
	},
>(
	rows: Row[],
	tools: ToolSet = {},
): Row[] =>
	rows.map((row) => {
		if (row.role !== "assistant") {
			return row;
		}

		const closed = closePendingToolParts(
			toChatAgentParts(readableChatMessageParts(row.parts)),
			tools,
		);

		return closed.changed
			? {
					...row,
					parts: mergeReadableParts(row.parts, closed.parts),
				}
			: row;
	});
