import { describe, expect, test } from "bun:test";
import { asSchema, InvalidToolInputError, type ToolSet } from "ai";
import { chatSources } from "@/lib/ai/citations/chat-sources";
import { buildRepositoryTools } from "@/lib/ai/tools/rag/toolset";
import { testRequestContext } from "@/lib/testing/request-context";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import { repairRepositoryToolCall } from "./repair-tool-call";

const tools = buildRepositoryTools({
	blocks: [],
	context: testRequestContext(),
	sources: chatSources([]),
});

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
		tools,
		inputSchema: async ({ toolName }) =>
			await asSchema((tools as ToolSet)[toolName]?.inputSchema).jsonSchema,
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

	test("a malformed searchRepositories call keeps as many wordings and assets as its schema allows, besides the promoted query", async () => {
		const assetIds = Array.from(
			{
				length: 25,
			},
			() => crypto.randomUUID(),
		);
		const repaired = await repair("searchRepositories", {
			queryVariants: [
				" APA ",
				"APA 7",
				"citation style",
				"reference list",
				"in-text citation",
				"bibliography",
			],
			assetIds,
			scope: "all",
		});

		expect(JSON.parse(repaired?.input ?? "null")).toEqual({
			query: "APA",
			queryVariants: [
				"APA 7",
				"citation style",
				"reference list",
				"in-text citation",
			],
			assetIds: assetIds.slice(0, 20),
		});
	});

	test("cuts the refs of a getPassages call to the most it reads", async () => {
		const repaired = await repair("getPassages", {
			passages: Array.from(
				{
					length: RETRIEVAL_LIMITS.maxFullPassageFetches + 3,
				},
				(_, index) => `k00000${index}`,
			),
		});

		expect(JSON.parse(repaired?.input ?? "null").passages).toHaveLength(
			RETRIEVAL_LIMITS.maxFullPassageFetches,
		);
	});

	test("leaves the calls of other tools alone", async () => {
		expect(
			await repair("createBot", {
				name: " Helper ",
			}),
		).toBeNull();
	});
});
