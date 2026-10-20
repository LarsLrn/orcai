import { describe, expect, test } from "bun:test";
import { type ProviderKind, providerKinds } from "@orcai/core";
import { listAnthropicModels } from "../src/provider-kinds/list-anthropic-models";
import {
	buildSystemInstructions,
	createProviderLanguageModel,
	listProviderModels,
	providerKindServerEntries,
} from "../src/provider-kinds/registry";

interface Recorded {
	url: string;
	headers: Headers;
}

/** A fetch that records each request and answers with the next body. */
const fakeFetch = (...bodies: unknown[]) => {
	const requests: Recorded[] = [];
	const fetch = ((input: string | URL | Request, init?: RequestInit) => {
		requests.push(
			input instanceof Request
				? {
						url: input.url,
						headers: input.headers,
					}
				: {
						url: input.toString(),
						headers: new Headers(init?.headers),
					},
		);
		const body = bodies.shift();
		return Promise.resolve(
			body === undefined
				? new Response("unavailable", {
						status: 503,
					})
				: Response.json(body),
		);
	}) as typeof globalThis.fetch;
	return {
		fetch,
		requests,
	};
};

const prompt = [
	{
		role: "user" as const,
		content: [
			{
				type: "text" as const,
				text: "Hi",
			},
		],
	},
];

const requestUrlOf = async (
	kind: ProviderKind,
	endpoint: string | null,
): Promise<string | undefined> => {
	const { fetch, requests } = fakeFetch();
	const model = createProviderLanguageModel(
		kind,
		{
			apiKey: "key",
			endpoint,
			fetch,
		},
		"some-model",
	);
	await Promise.resolve(
		model.doGenerate({
			prompt,
		}),
	).catch(() => undefined);
	return requests[0]?.url;
};

describe("provider kind registry", () => {
	test("has one server entry per kind", () => {
		expect(Object.keys(providerKindServerEntries).sort()).toEqual(
			providerKinds.map(({ kind }) => kind).sort(),
		);
	});

	test("an OpenAI-compatible model calls the endpoint", async () => {
		expect(
			await requestUrlOf("openai-compatible", "https://llm.example.org/v1"),
		).toBe("https://llm.example.org/v1/chat/completions");
	});

	test("an OpenAI-compatible model needs an endpoint", () => {
		expect(() =>
			createProviderLanguageModel(
				"openai-compatible",
				{
					apiKey: "key",
					endpoint: null,
				},
				"some-model",
			),
		).toThrow();
	});

	test("official kinds call their default API and ignore an endpoint", async () => {
		for (const endpoint of [
			null,
			"https://llm.example.org/v1",
		]) {
			expect(await requestUrlOf("openai", endpoint)).toStartWith(
				"https://api.openai.com/v1/",
			);
			expect(await requestUrlOf("anthropic", endpoint)).toBe(
				"https://api.anthropic.com/v1/messages",
			);
		}
	});

	test("OpenAI kinds list the models of /models", async () => {
		const listing = {
			object: "list",
			data: [
				{
					id: "gpt-x",
					object: "model",
					created: 0,
					owned_by: "openai",
				},
			],
		};
		const compatible = fakeFetch(listing);
		const official = fakeFetch(listing);

		const [compatibleModels] = await Promise.all([
			listProviderModels("openai-compatible", {
				apiKey: "key",
				endpoint: "https://llm.example.org/v1",
				fetch: compatible.fetch,
			}),
			listProviderModels("openai", {
				apiKey: "key",
				endpoint: null,
				fetch: official.fetch,
			}),
		]);

		expect(compatibleModels).toEqual([
			{
				providerModelId: "gpt-x",
				name: "gpt-x",
				description: "Model ID: gpt-x | Owned by openai",
			},
		]);
		expect(compatible.requests[0]?.url).toBe(
			"https://llm.example.org/v1/models",
		);
		expect(official.requests[0]?.url).toBe("https://api.openai.com/v1/models");
	});
});

describe("listAnthropicModels", () => {
	test("maps every page of the Models API", async () => {
		const { fetch, requests } = fakeFetch(
			{
				data: [
					{
						type: "model",
						id: "claude-a",
						display_name: "Claude A",
						created_at: "2026-01-01T00:00:00Z",
					},
				],
				has_more: true,
				first_id: "claude-a",
				last_id: "claude-a",
			},
			{
				data: [
					{
						type: "model",
						id: "claude-b",
						display_name: "Claude B",
						created_at: "2026-02-01T00:00:00Z",
					},
				],
				has_more: false,
				first_id: "claude-b",
				last_id: "claude-b",
			},
		);

		const models = await listAnthropicModels({
			apiKey: "sk-ant",
			endpoint: null,
			fetch,
		});

		expect(models).toEqual([
			{
				providerModelId: "claude-a",
				name: "Claude A",
				description: "Model ID: claude-a",
			},
			{
				providerModelId: "claude-b",
				name: "Claude B",
				description: "Model ID: claude-b",
			},
		]);
		expect(requests.map(({ url }) => new URL(url).search)).toEqual([
			"?limit=1000",
			"?limit=1000&after_id=claude-a",
		]);
		for (const { url, headers } of requests) {
			expect(url).toStartWith("https://api.anthropic.com/v1/models");
			expect(headers.get("x-api-key")).toBe("sk-ant");
			expect(headers.get("anthropic-version")).toBe("2023-06-01");
		}
	});

	test("fails when more pages are reported without a new cursor", async () => {
		const page = (lastId: string | null) => ({
			data: [],
			has_more: true,
			first_id: lastId,
			last_id: lastId,
		});

		for (const pages of [
			[
				page(null),
			],
			[
				page("claude-a"),
				page("claude-a"),
			],
		]) {
			const { fetch } = fakeFetch(...pages);

			await expect(
				listAnthropicModels({
					apiKey: "sk-ant",
					endpoint: null,
					fetch,
				}),
			).rejects.toThrow("without advancing the cursor");
		}
	});

	test("fails on an error response", async () => {
		const { fetch } = fakeFetch();

		await expect(
			listAnthropicModels({
				apiKey: "sk-ant",
				endpoint: null,
				fetch,
			}),
		).rejects.toThrow("503");
	});
});

describe("buildSystemInstructions", () => {
	const systemPrompt = {
		stable: "You are helpful.",
		variable: "Current user: Ada",
	};

	test("marks the stable part for Anthropic's prompt cache", () => {
		expect(buildSystemInstructions("anthropic", systemPrompt)).toEqual([
			{
				role: "system",
				content: "You are helpful.",
				providerOptions: {
					anthropic: {
						cacheControl: {
							type: "ephemeral",
						},
					},
				},
			},
			{
				role: "system",
				content: "Current user: Ada",
			},
		]);
	});

	test("sends one system message to kinds without a prompt cache", () => {
		for (const kind of [
			"openai-compatible",
			"openai",
		] as const) {
			expect(buildSystemInstructions(kind, systemPrompt)).toEqual([
				{
					role: "system",
					content: "You are helpful.\n\nCurrent user: Ada",
				},
			]);
			expect(
				buildSystemInstructions(kind, {
					stable: "You are helpful.",
				}),
			).toEqual([
				{
					role: "system",
					content: "You are helpful.",
				},
			]);
		}
	});
});
