import {
	asSchema,
	getToolName,
	isToolUIPart,
	type ToolSet,
	type UIMessage,
} from "ai";

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

const inputError = async (
	tools: ToolSet,
	toolName: string,
	input: unknown,
): Promise<string | undefined> => {
	const tool = tools[toolName];
	const validate = tool?.inputSchema && asSchema(tool.inputSchema).validate;
	if (!validate) return undefined;

	const result = await validate(input);
	return result.success ? undefined : result.error.message;
};

/**
 * Stored calls whose input no longer validates would fail every turn: an open
 * one fails with INVALID_TOOL_INPUT, so the model reads the error and the turn
 * goes on, and a settled one keeps its result as an untyped call.
 */
const closePart = async (part: Part, tools: ToolSet): Promise<Part> => {
	if (
		!isToolUIPart(part) ||
		!(OPEN_STATES.has(part.state) || SETTLED_STATES.has(part.state))
	) {
		return part;
	}

	const toolName = getToolName(part);
	const error = await inputError(tools, toolName, part.input);
	if (error === undefined) return part;

	if (OPEN_STATES.has(part.state)) {
		const { approval: _, ...rest } = part;
		return {
			...rest,
			state: "output-error",
			errorText: `INVALID_TOOL_INPUT: Invalid input for tool ${toolName}: ${error}`,
		} as Part;
	}

	const { type: _, ...rest } = part;
	return {
		...rest,
		type: "dynamic-tool",
		toolName,
	} as Part;
};

export const closeInvalidToolParts = async <Message extends UIMessage>(
	messages: Message[],
	tools: ToolSet,
): Promise<Message[]> =>
	Promise.all(
		messages.map(async (message) => {
			if (message.role !== "assistant") return message;

			const parts = await Promise.all(
				message.parts.map((part) => closePart(part, tools)),
			);

			return parts.some((part, index) => part !== message.parts[index])
				? {
						...message,
						parts,
					}
				: message;
		}),
	);
