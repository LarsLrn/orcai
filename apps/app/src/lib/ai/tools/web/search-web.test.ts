import { describe, expect, test } from "bun:test";
import type { WebSearchQuery } from "@orcai/ai";
import * as Effect from "effect/Effect";
import "../assistant/test-procedures";

const { AssistantToolError } = await import("@/lib/ai/tools/tool-error");
const { searchWebTool } = await import("./search-web");

const call = {
	toolCallId: "search",
	messages: [],
} as never;

describe("searchWebTool", () => {
	test("searches within the allowed domains and answers with url, title and content", async () => {
		const searches: WebSearchQuery[] = [];
		const tool = searchWebTool({
			search: (query) => {
				searches.push(query);
				return Effect.succeed([
					{
						url: "https://docs.example.org/orcas",
						title: "Orcas",
						content: "Orcas hunt in pods.",
					},
				]);
			},
			allowedDomains: [
				"example.org",
			],
		});

		expect(
			await tool.execute?.(
				{
					query: "orcas",
				},
				call,
			),
		).toEqual({
			results: [
				{
					url: "https://docs.example.org/orcas",
					title: "Orcas",
					content: "Orcas hunt in pods.",
				},
			],
		});
		expect(searches).toEqual([
			{
				query: "orcas",
				allowedDomains: [
					"example.org",
				],
				maxResults: 5,
			},
		]);
	});

	test("a failed search reaches the model as the tool's error", async () => {
		const tool = searchWebTool({
			search: () =>
				Effect.fail(
					new AssistantToolError(
						"QUOTA_EXHAUSTED: The search provider's quota is used up.",
					),
				),
			allowedDomains: [],
		});

		await expect(
			tool.execute?.(
				{
					query: "orcas",
				},
				call,
			),
		).rejects.toThrow(
			"QUOTA_EXHAUSTED: The search provider's quota is used up.",
		);
	});
});
