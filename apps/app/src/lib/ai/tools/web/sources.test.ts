import { describe, expect, test } from "bun:test";
import { citedWebSources } from "./sources";

const web = (url: string, title = `Title of ${url}`) => ({
	kind: "web" as const,
	url,
	title,
});

const urlCitation = (url: string, title?: string) => ({
	source: {
		type: "source" as const,
		sourceType: "url" as const,
		id: url,
		url,
		title,
	},
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

	test("adds the pages the model's own search cites, once each", () => {
		expect(
			citedWebSources(
				[
					{
						type: "text",
						text: "First claim. Second claim.",
						citations: [
							urlCitation("https://example.org/a", "A"),
							urlCitation("https://example.org/a"),
							urlCitation("https://example.org/b"),
						],
					},
					{
						type: "text",
						text: "Third claim.",
						citations: [
							urlCitation("https://example.org/cited", "Other title"),
						],
					},
				],
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

	test("lists no page the model's own search only retrieved", () => {
		expect(
			citedWebSources(
				[
					{
						type: "source-url",
						sourceId: "1",
						url: "https://example.org/retrieved",
						title: "Retrieved",
					},
					{
						type: "text",
						text: "No claim.",
					},
				],
				{},
			),
		).toEqual([]);
	});

	test("lists no page the app does not open", () => {
		expect(
			citedWebSources(
				[
					{
						type: "text",
						text: "A claim.",
						citations: [
							urlCitation("javascript:alert(1)"),
						],
					},
				],
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
