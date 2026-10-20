import { InvalidToolInputError, NoSuchToolError } from "ai";
import {
	ASSISTANT_TOOL_GROUPS,
	DEFERRED_TOOL_GROUPS,
} from "@/lib/ai/tools/assistant/groups";
import { AssistantToolError } from "@/lib/ai/tools/assistant/procedure-tool";
import { streamErrorReason } from "./stream-error-reason";

const deferredGroupOf = (toolName: string) =>
	DEFERRED_TOOL_GROUPS.find((group) =>
		(ASSISTANT_TOOL_GROUPS[group] as readonly string[]).includes(toolName),
	);

const toolNotAvailableText = (toolName: string) => {
	const group = deferredGroupOf(toolName);

	return group
		? `TOOL_NOT_AVAILABLE: ${toolName} is not loaded; call loadTools with the ${group} group first, then call ${toolName} in the next step.`
		: `TOOL_NOT_AVAILABLE: There is no tool named ${toolName} in this conversation.`;
};

// For a call it could not parse, the SDK also reports the error as a string, its name in front.
const UNAVAILABLE_TOOL_MESSAGE =
	/^Model tried to call unavailable tool '(.+?)'\./;
const INVALID_INPUT_MESSAGE = "Invalid input for tool ";
const SDK_ERROR_NAME = /^AI_\w+Error: /;

/**
 * The error text the UI stream records for a failure, which a later turn's
 * model reads back: a tool's own error text, the SDK's text for a call it
 * could not run, or the reason of any other failure.
 */
export const streamErrorText = (error: unknown): string => {
	if (error instanceof AssistantToolError) {
		return error.message;
	}

	if (NoSuchToolError.isInstance(error)) {
		return toolNotAvailableText(error.toolName);
	}

	if (InvalidToolInputError.isInstance(error)) {
		return `INVALID_TOOL_INPUT: ${error.message}`;
	}

	if (typeof error === "string") {
		const text = error.replace(SDK_ERROR_NAME, "");
		const unavailable = text.match(UNAVAILABLE_TOOL_MESSAGE)?.[1];

		if (unavailable !== undefined) {
			return toolNotAvailableText(unavailable);
		}

		if (text.startsWith(INVALID_INPUT_MESSAGE)) {
			return `INVALID_TOOL_INPUT: ${text}`;
		}
	}

	return streamErrorReason(error, "AI_STREAM_FAILED");
};
