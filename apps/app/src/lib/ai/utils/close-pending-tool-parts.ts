import { getToolName, isToolUIPart, type ToolSet, type UIMessage } from "ai";

/** Why a pending call was closed, as the sentence the model reads for it. */
export const TOOL_CLOSE_SENTENCES = {
	superseded: "Not run: the user sent a new message instead.",
	interrupted: "Not completed: the turn was interrupted.",
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
		case "input-available": {
			const tool = tools[getToolName(part)];
			const isClientTool = tool !== undefined && tool.execute === undefined;

			return {
				...part,
				state: "output-error",
				errorText:
					TOOL_CLOSE_SENTENCES[isClientTool ? "superseded" : "interrupted"],
			};
		}
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
