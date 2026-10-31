import { describe, expect, test } from "bun:test";
import { InvalidToolInputError } from "ai";
import {
	type ChatAgentTools,
	repairRepositoryToolCall,
} from "./repair-tool-call";

const repair = (toolName: string, input: Record<string, unknown>) => {
	const toolInput = JSON.stringify(input);

	return repairRepositoryToolCall({
		toolCall: {
			type: "tool-call",
			toolCallId: "call-1",
			toolName,
			input: toolInput,
		},
		error: new InvalidToolInputError({
			toolName,
			toolInput,
			cause: new Error("invalid"),
		}),
		instructions: undefined,
		system: undefined,
		messages: [],
		tools: {} as ChatAgentTools,
		inputSchema: () => Promise.resolve({}),
	});
};

describe("repairRepositoryToolCall", () => {
	test("a malformed getAssetPage call keeps its asset title query", async () => {
		const repaired = await repair("getAssetPage", {
			pageNumber: 4.7,
			assetTitleQuery: "  APA guide ",
			limit: 99,
			documentTitleQuery: "Old guide",
		});

		expect(JSON.parse(repaired?.input ?? "null")).toEqual({
			page: 4,
			limit: 30,
			assetTitleQuery: "APA guide",
		});
	});

	test("a malformed getPassages call keeps its refs", async () => {
		const repaired = await repair("getPassages", {
			passages: [
				" k000001 ",
				"",
			],
			neighbours: 5,
		});

		expect(JSON.parse(repaired?.input ?? "null")).toEqual({
			passages: [
				"k000001",
			],
			neighbours: 2,
		});
	});
});
