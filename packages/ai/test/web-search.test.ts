import { describe, expect, test } from "bun:test";
import { generateText } from "ai";
import {
	createProviderLanguageModel,
	NATIVE_WEB_SEARCH_TOOL_NAME,
	nativeWebSearchTool,
} from "../src/provider-kinds/registry";
import { isAllowedUrl } from "../src/web-search/allowed-domains";
import { createWebSearch } from "../src/web-search/registry";
import { WebSearchError } from "../src/web-search/types";

describe("isAllowedUrl", () => {
	test("allows any http(s) page without a domain list", () => {
		expect(isAllowedUrl("https://example.org/a", [])).toBe(true);
		expect(isAllowedUrl("http://example.org/a", [])).toBe(true);
	});

	test("refuses other schemes and broken URLs", () => {
		expect(isAllowedUrl("javascript:alert(1)", [])).toBe(false);
		expect(isAllowedUrl("ftp://example.org/a", [])).toBe(false);
		expect(isAllowedUrl("not a url", [])).toBe(false);
	});

	test("allows a listed domain and its subdomains", () => {
		const allowed = [
			"example.org",
		];
		expect(isAllowedUrl("https://example.org/a", allowed)).toBe(true);
		expect(isAllowedUrl("https://docs.example.org/a", allowed)).toBe(true);
		expect(isAllowedUrl("https://DOCS.Example.org./a", allowed)).toBe(true);
	});

	test("refuses hosts that only look alike", () => {
		const allowed = [
			"example.org",
		];
		expect(isAllowedUrl("https://badexample.org/a", allowed)).toBe(false);
		expect(isAllowedUrl("https://example.org.evil.com/a", allowed)).toBe(false);
		expect(isAllowedUrl("https://other.net/example.org", allowed)).toBe(false);
	});
});

/** A Tavily stand-in that records each body and answers with `results`. */
const tavily = (answer: () => Response) => {
	const bodies: unknown[] = [];
	const urls: string[] = [];
	const fetch = ((input: string | URL | Request, init?: RequestInit) => {
		urls.push(input.toString());
		bodies.push(JSON.parse(String(init?.body)));
		return Promise.resolve(answer());
	}) as typeof globalThis.fetch;
	return {
		fetch,
		bodies,
		urls,
	};
};

const result = (url: string) => ({
	url,
	title: `Title of ${url}`,
	content: `Content of ${url}`,
	score: 0.5,
	raw_content: null,
});

describe("createWebSearch with Tavily", () => {
	test("sends the query, count and domains and keeps only allowed results", async () => {
		const mock = tavily(() =>
			Response.json({
				query: "q",
				results: [
					result("https://docs.example.org/a"),
					result("https://elsewhere.net/b"),
					result("https://example.org/c"),
				],
				response_time: 0.1,
			}),
		);
		const search = createWebSearch("tavily", {
			apiKey: "tvly-key",
			endpoint: "https://tavily.example/v1/",
			fetch: mock.fetch,
		});

		const results = await search({
			query: "orcas",
			allowedDomains: [
				"example.org",
			],
			maxResults: 5,
		});

		expect(mock.urls).toEqual([
			"https://tavily.example/v1/search",
		]);
		expect(mock.bodies[0]).toEqual({
			query: "orcas",
			search_depth: "basic",
			topic: "general",
			max_results: 5,
			include_domains: [
				"example.org",
			],
		});
		expect(results).toEqual([
			{
				url: "https://docs.example.org/a",
				title: "Title of https://docs.example.org/a",
				content: "Content of https://docs.example.org/a",
			},
			{
				url: "https://example.org/c",
				title: "Title of https://example.org/c",
				content: "Content of https://example.org/c",
			},
		]);
	});

	test("caps the results at the requested count", async () => {
		const mock = tavily(() =>
			Response.json({
				results: [
					result("https://a.example/1"),
					result("https://b.example/2"),
				],
			}),
		);
		const search = createWebSearch("tavily", {
			apiKey: "tvly-key",
			endpoint: null,
			fetch: mock.fetch,
		});

		const results = await search({
			query: "orcas",
			allowedDomains: [],
			maxResults: 1,
		});

		expect(mock.urls).toEqual([
			"https://api.tavily.com/search",
		]);
		expect(mock.bodies[0]).not.toHaveProperty("include_domains");
		expect(results.map(({ url }) => url)).toEqual([
			"https://a.example/1",
		]);
	});

	test("rejects with Tavily's message and status", async () => {
		const search = createWebSearch("tavily", {
			apiKey: "tvly-key",
			endpoint: null,
			fetch: tavily(() =>
				Response.json(
					{
						detail: {
							error: "This request exceeds your plan's set usage limit.",
						},
					},
					{
						status: 432,
					},
				),
			).fetch,
		});

		const failure = await search({
			query: "orcas",
			allowedDomains: [],
			maxResults: 5,
		}).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(WebSearchError);
		expect(failure).toMatchObject({
			message: "This request exceeds your plan's set usage limit.",
			status: 432,
		});
	});
});

describe("nativeWebSearchTool", () => {
	/** The tools a call with the native search tool sends to `kind`. */
	const sentTools = async (
		kind: "anthropic" | "openai",
		allowedDomains: string[],
	) => {
		const bodies: {
			tools?: unknown[];
		}[] = [];
		const fetch = ((_input: unknown, init?: RequestInit) => {
			bodies.push(JSON.parse(String(init?.body)));
			return Promise.resolve(
				new Response("unavailable", {
					status: 400,
				}),
			);
		}) as typeof globalThis.fetch;
		const tool = nativeWebSearchTool(kind, allowedDomains);
		await generateText({
			model: createProviderLanguageModel(
				kind,
				{
					apiKey: "key",
					endpoint: null,
					fetch,
				},
				"some-model",
			),
			prompt: "Hi",
			tools: tool
				? {
						[NATIVE_WEB_SEARCH_TOOL_NAME]: tool,
					}
				: {},
			maxRetries: 0,
		}).catch(() => undefined);
		return bodies[0]?.tools;
	};

	test("Anthropic searches at most five times a request within the domains", async () => {
		expect(
			await sentTools("anthropic", [
				"example.org",
			]),
		).toEqual([
			{
				type: "web_search_20260318",
				name: "web_search",
				max_uses: 5,
				allowed_domains: [
					"example.org",
				],
			},
		]);
	});

	test("OpenAI searches within the domains", async () => {
		expect(
			await sentTools("openai", [
				"example.org",
			]),
		).toEqual([
			expect.objectContaining({
				type: "web_search",
				filters: {
					allowed_domains: [
						"example.org",
					],
				},
			}),
		]);
	});

	test("an empty list searches the whole web", async () => {
		const [anthropicTool] = (await sentTools("anthropic", [])) ?? [];
		const [openaiTool] = (await sentTools("openai", [])) ?? [];

		expect(anthropicTool).not.toHaveProperty("allowed_domains");
		expect(openaiTool).not.toHaveProperty("filters");
	});
});
