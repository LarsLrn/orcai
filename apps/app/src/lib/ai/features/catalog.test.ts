import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { referenceMatrix } from "@/components/chat/gen-ui/matrix/fixtures";
import { referenceReview } from "@/components/chat/gen-ui/review/fixtures";
import { NO_WEB_SEARCH, type TurnWebSearch } from "@/lib/ai/tools/web/toolset";
import { resolveFeatures } from "./resolve-features";

const offeredTools = (
	features: unknown,
	webSearch: TurnWebSearch = NO_WEB_SEARCH,
) =>
	Effect.runSync(resolveFeatures(features)).flatMap(({ entry, settings }) =>
		Object.entries(
			entry.buildTools({
				context: undefined as never,
				settings,
				turn: {
					webSearch,
					history: [],
					citations: true,
				},
			}),
		),
	);

const providerSearch: TurnWebSearch = {
	kind: "provider",
	search: () => Effect.succeed([]),
};

const webSearch = {
	webSearch: {
		allowedDomains: [
			"example.org",
		],
	},
};

describe("featureCatalog", () => {
	test("Generative UI offers every display tool", () => {
		expect(
			offeredTools({
				generativeUi: {},
			}).map(([name]) => name),
		).toEqual([
			"showChecklist",
			"showReview",
			"showMatrix",
		]);
	});

	test("no display tool is offered with Generative UI off", () => {
		expect(offeredTools({})).toEqual([]);
	});

	test("display tools only answer that they were shown", async () => {
		const tools = Object.fromEntries(
			offeredTools({
				generativeUi: {},
			}),
		);
		for (const [name, input] of [
			[
				"showReview",
				referenceReview,
			],
			[
				"showMatrix",
				referenceMatrix,
			],
		] as const) {
			expect(
				await tools[name].execute?.(input, {
					toolCallId: name,
					messages: [],
				} as never),
			).toEqual({
				shown: true,
			});
		}
	});

	test("web search offers no tool where the turn cannot search", () => {
		expect(offeredTools(webSearch)).toEqual([]);
		expect(
			offeredTools(webSearch, {
				kind: "native",
				modelKind: "openai-compatible",
			}),
		).toEqual([]);
	});

	test("web search offers the model's own search under model native", () => {
		for (const modelKind of [
			"anthropic",
			"openai",
		] as const) {
			expect(
				offeredTools(webSearch, {
					kind: "native",
					modelKind,
				}).map(([name]) => name),
			).toEqual([
				"web_search",
			]);
		}
	});

	test("web search offers searchWeb with a search provider, within the bot's domains", () => {
		const tools = Object.fromEntries(offeredTools(webSearch, providerSearch));
		expect(Object.keys(tools)).toEqual([
			"searchWeb",
		]);
		expect(tools.searchWeb.description).toContain("example.org");
	});

	test("web search is off unless the feature is on", () => {
		expect(offeredTools({}, providerSearch)).toEqual([]);
	});
});
