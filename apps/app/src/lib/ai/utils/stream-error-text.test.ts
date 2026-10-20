import { describe, expect, test } from "bun:test";
import { InvalidToolInputError, NoSuchToolError } from "ai";
import { AssistantToolError } from "@/lib/ai/tools/assistant/procedure-tool";
import { streamErrorText } from "./stream-error-text";

const invalidInput = new InvalidToolInputError({
	toolName: "updateBot",
	toolInput: '{"name":1}',
	cause: new Error("name: Expected string, received number"),
});

describe("streamErrorText", () => {
	test("a tool's own error passes as it is", () => {
		expect(
			streamErrorText(
				new AssistantToolError("BOT_NOT_FOUND: No bot with id b-1."),
			),
		).toBe("BOT_NOT_FOUND: No bot with id b-1.");
	});

	test("invalid input keeps the SDK's account of the schema problem", () => {
		const text = streamErrorText(invalidInput);

		expect(text).toStartWith(
			"INVALID_TOOL_INPUT: Invalid input for tool updateBot:",
		);
		expect(text).toContain("name: Expected string, received number");
		expect(streamErrorText(invalidInput.message)).toBe(text);
		expect(streamErrorText(String(invalidInput))).toBe(text);
	});

	test("a tool of a group not loaded points to loadTools", () => {
		const error = new NoSuchToolError({
			toolName: "updateBot",
			availableTools: [
				"findBots",
				"loadTools",
			],
		});
		const text =
			"TOOL_NOT_AVAILABLE: updateBot is not loaded; call loadTools with the bots group first, then call updateBot in the next step.";

		expect(streamErrorText(error)).toBe(text);
		expect(streamErrorText(error.message)).toBe(text);
		expect(streamErrorText(String(error))).toBe(text);
	});

	test("an unknown tool is named as missing", () => {
		expect(
			streamErrorText(
				new NoSuchToolError({
					toolName: "renameBot",
				}),
			),
		).toBe(
			"TOOL_NOT_AVAILABLE: There is no tool named renameBot in this conversation.",
		);
	});

	test("any other failure falls back to its reason", () => {
		expect(streamErrorText(new Error("provider exploded"))).toBe(
			"AI_STREAM_FAILED",
		);
		expect(streamErrorText("some other text")).toBe("AI_STREAM_FAILED");
		expect(
			streamErrorText({
				reason: "CHAT_NOT_FOUND",
			}),
		).toBe("CHAT_NOT_FOUND");
	});
});
