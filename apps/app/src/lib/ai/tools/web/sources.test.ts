import { describe, expect, test } from "bun:test";
import { citedWebSources } from "./sources";

const web = (url: string, title = `Title of ${url}`) => ({
	kind: "web" as const,
	url,
	title,
});

describe("citedWebSources", () => {
	test("lists the web pages the reply cites, in the order it cites them", () => {
		expect(
			citedWebSources([], {
				wbbbbbb: web("https://example.org/b"),
				kaaaaaa: {
					kind: "asset",
					assetId: "asset",
					title: "Handbook",
				},
				waaaaaa: web("https://example.org/a"),
				wwithdr: null,
			}),
		).toEqual([
			{
				url: "https://example.org/b",
				title: "Title of https://example.org/b",
			},
			{
				url: "https://example.org/a",
				title: "Title of https://example.org/a",
			},
		]);
	});

	test("adds the model's own URL sources once each", () => {
		expect(
			citedWebSources(
				[
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
					{
						type: "source-url",
						sourceId: "4",
						url: "https://example.org/cited",
						title: "Other title",
					},
				] as never,
				{
					wcited0: web("https://example.org/cited", "Cited"),
				},
			),
		).toEqual([
			{
				url: "https://example.org/cited",
				title: "Cited",
			},
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

	test("lists no page the app does not open", () => {
		expect(
			citedWebSources(
				[
					{
						type: "source-url",
						sourceId: "1",
						url: "javascript:alert(1)",
					},
				] as never,
				{
					wcreds0: web("https://user:secret@example.org/page"),
				},
			),
		).toEqual([]);
	});

	test("lists no search result the reply only links to", () => {
		expect(
			citedWebSources(
				[
					{
						type: "tool-searchWeb",
						state: "output-available",
						output: {
							results: [
								{
									url: "https://example.org/linked",
									title: "Linked",
									content: "",
								},
							],
						},
					},
					{
						type: "text",
						text: "See [Linked](https://example.org/linked).",
					},
				] as never,
				{},
			),
		).toEqual([]);
	});
});
