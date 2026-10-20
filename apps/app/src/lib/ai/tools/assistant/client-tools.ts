import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { z } from "zod/v4";
import { requestUploadOutputSchema } from "./bots/request-upload";

type Part = UIMessage["parts"][number];
type ToolCallPart<P extends Part> = Extract<
	P,
	{
		toolCallId: string;
	}
>;

/** The output schema of each tool the browser answers; the server never runs them. */
export const CLIENT_TOOL_OUTPUT_SCHEMAS = {
	requestUpload: requestUploadOutputSchema,
} satisfies Record<string, z.ZodType>;

export const isClientToolPart = <P extends Part>(
	part: P,
): part is ToolCallPart<P> =>
	isToolUIPart(part) &&
	Object.hasOwn(CLIENT_TOOL_OUTPUT_SCHEMAS, getToolName(part));

/** A client tool's call the browser has answered. */
export const hasClientToolOutput = <P extends Part>(
	part: P,
): part is ToolCallPart<P> =>
	isClientToolPart(part) &&
	(part.state === "output-available" || part.state === "output-error");
