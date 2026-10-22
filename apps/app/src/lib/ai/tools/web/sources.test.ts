import { describe, expect, test } from "bun:test";
import { citedWebSources } from "./sources";

const searchWeb = (urls: string[]) => ({
	type: "tool-searchWeb",
	state: "output-available",
	output: {
		results: urls.map((url) => ({
			url,
			title: `Title of ${url}`,
			content: "",
		})),
	},
});

describe("citedWebSources", () => {
	test("lists the model's own URL sources once each", () => {
		expect(
			citedWebSources([
				{
					type: "source-url",
					sourceId: "1",
					url: "https://example.org/a",
					title: "A",
				},
				{
					type: "source-url",
					sourceId: "2",
					url: "https://example.org/a",
				},
				{
					type: "source-url",
					sourceId: "3",
					url: "https://example.org/b",
				},
			] as never),
		).toEqual([
			{
				url: "https://example.org/a",
				title: "A",
			},
			{
				url: "https://example.org/b",
				title: undefined,
			},
		]);
	});

	test("lists the searchWeb results the text links to", () => {
		expect(
			citedWebSources([
				searchWeb([
					"https://example.org/cited",
					"https://example.org/unused",
				]),
				{
					type: "text",
					text: "Orcas hunt in pods ([Orcas](https://example.org/cited)).",
				},
			] as never),
		).toEqual([
			{
				url: "https://example.org/cited",
				title: "Title of https://example.org/cited",
			},
		]);
	});

	test("matches whole URLs, not their prefixes", () => {
		expect(
			citedWebSources([
				searchWeb([
					"https://example.org/a",
					"https://example.org/b",
				]),
				{
					type: "text",
					text: "See [more](https://example.org/a-longer-page) and https://example.org/b.",
				},
			] as never).map(({ url }) => url),
		).toEqual([
			"https://example.org/b",
		]);
	});

	test("matches URLs with balanced parentheses", () => {
		expect(
			citedWebSources([
				searchWeb([
					"https://en.example.org/wiki/Orca_(band)",
					"https://en.example.org/wiki/Pod_(whales)",
				]),
				{
					type: "text",
					text: "See [the band](https://en.example.org/wiki/Orca_(band)) and (https://en.example.org/wiki/Pod_(whales)).",
				},
			] as never).map(({ url }) => url),
		).toEqual([
			"https://en.example.org/wiki/Orca_(band)",
			"https://en.example.org/wiki/Pod_(whales)",
		]);
	});

	test("lists nothing without web search", () => {
		expect(
			citedWebSources([
				{
					type: "text",
					text: "See https://example.org.",
				},
			] as never),
		).toEqual([]);
	});
});
