import { describe, expect, test } from "bun:test";
import {
	hasNativeWebSearch,
	type ModelProviderKind,
	modelProviderKinds,
} from "@orcai/core";
import { listAnthropicModels } from "../src/provider-kinds/list-anthropic-models";
import {
	buildSystemInstructions,
	createProviderLanguageModel,
	listProviderModels,
	nativeWebSearchTool,
	providerCompaction,
	providerKindServerEntries,
	providerToolLoading,
	withholdToolCalls,
} from "../src/provider-kinds/registry";

interface Recorded {
	url: string;
	headers: Headers;
	body?: unknown;
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
						body:
							typeof init?.body === "string"
								? JSON.parse(init.body)
								: undefined,
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
	kind: ModelProviderKind,
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
	test("has one server entry per model kind", () => {
		expect(Object.keys(providerKindServerEntries).sort()).toEqual(
			[
				...modelProviderKinds,
			].sort(),
		);
	});

	test("offers a native web search tool exactly for kinds that have one", () => {
		for (const kind of modelProviderKinds) {
			expect(nativeWebSearchTool(kind, []) !== undefined).toBe(
				hasNativeWebSearch(kind),
			);
		}
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
				contextWindow: null,
				maxOutputTokens: null,
				capabilities: null,
			},
		]);
		expect(compatible.requests[0]?.url).toBe(
			"https://llm.example.org/v1/models",
		);
		expect(official.requests[0]?.url).toBe("https://api.openai.com/v1/models");
	});

	test("OpenAI-compatible servers report token limits in their own fields", async () => {
		const model = (id: string, limits: Record<string, unknown>) => ({
			id,
			object: "model",
			created: 0,
			owned_by: "someone",
			...limits,
		});
		const { fetch } = fakeFetch({
			object: "list",
			data: [
				model("openrouter", {
					context_length: 200_000,
					top_provider: {
						context_length: 200_000,
						max_completion_tokens: 64_000,
					},
				}),
				model("vllm", {
					max_model_len: 32_768,
				}),
				model("groq", {
					context_window: 131_072,
					max_completion_tokens: 8_192,
				}),
				model("implausible", {
					context_length: "large",
					top_provider: null,
					max_completion_tokens: 0,
				}),
			],
		});

		const models = await listProviderModels("openai-compatible", {
			apiKey: "key",
			endpoint: "https://llm.example.org/v1",
			fetch,
		});

		expect(
			models.map(({ providerModelId, contextWindow, maxOutputTokens }) => ({
				providerModelId,
				contextWindow,
				maxOutputTokens,
			})),
		).toEqual([
			{
				providerModelId: "openrouter",
				contextWindow: 200_000,
				maxOutputTokens: 64_000,
			},
			{
				providerModelId: "vllm",
				contextWindow: 32_768,
				maxOutputTokens: null,
			},
			{
				providerModelId: "groq",
				contextWindow: 131_072,
				maxOutputTokens: 8_192,
			},
			{
				providerModelId: "implausible",
				contextWindow: null,
				maxOutputTokens: null,
			},
		]);
	});

	test("OpenRouter's metadata reports capabilities, other servers report none", async () => {
		const model = (id: string, metadata: Record<string, unknown>) => ({
			id,
			object: "model",
			created: 0,
			owned_by: "someone",
			...metadata,
		});
		const architecture = (input: string[], output: string[]) => ({
			modality: `${input.join("+")}->${output.join("+")}`,
			input_modalities: input,
			output_modalities: output,
			tokenizer: "Other",
			instruct_type: null,
		});
		const { fetch } = fakeFetch({
			object: "list",
			data: [
				model("anthropic/claude-opus-4.5", {
					architecture: architecture(
						[
							"file",
							"image",
							"text",
						],
						[
							"text",
						],
					),
					supported_parameters: [
						"include_reasoning",
						"max_tokens",
						"reasoning",
						"tool_choice",
						"tools",
					],
				}),
				model("meta-llama/llama-3-8b-instruct", {
					architecture: architecture(
						[
							"text",
						],
						[
							"text",
						],
					),
					supported_parameters: [
						"max_tokens",
						"temperature",
					],
				}),
				model("amazon/titan-embed-image-v1", {
					architecture: architecture(
						[
							"text",
							"image",
						],
						[
							"embeddings",
						],
					),
					supported_parameters: [],
				}),
				model("google/gemini-image", {
					architecture: architecture(
						[
							"text",
							"audio",
							"video",
						],
						[
							"text",
							"image",
							"audio",
						],
					),
					supported_parameters: [
						"tools",
					],
				}),
				model("vllm", {
					max_model_len: 32_768,
				}),
				model("partial", {
					architecture: architecture(
						[
							"text",
						],
						[
							"text",
						],
					),
				}),
			],
		});

		const models = await listProviderModels("openai-compatible", {
			apiKey: "key",
			endpoint: "https://openrouter.ai/api/v1",
			fetch,
		});

		expect(
			Object.fromEntries(
				models.map(({ providerModelId, capabilities }) => [
					providerModelId,
					capabilities,
				]),
			),
		).toEqual({
			"anthropic/claude-opus-4.5": [
				"text",
				"image",
				"reasoning",
				"tool-calling",
			],
			"meta-llama/llama-3-8b-instruct": [
				"text",
			],
			"amazon/titan-embed-image-v1": [
				"embedding",
				"image",
			],
			"google/gemini-image": [
				"text",
				"image-generation",
				"video",
				"audio",
				"audio-generation",
				"tool-calling",
			],
			vllm: null,
			partial: null,
		});
	});
});

describe("providerToolLoading", () => {
	test("Claude models with tool search load tools through references", () => {
		for (const modelId of [
			"claude-opus-5-5",
			"claude-sonnet-5",
			"claude-haiku-4-5-20251001",
			"claude-opus-4-5",
			"claude-sonnet-4-5-20250929",
		]) {
			expect(providerToolLoading("anthropic", modelId).type).toBe("references");
		}
	});

	test("older Claude models and other kinds keep active tools", () => {
		for (const modelId of [
			"claude-opus-4-1-20250805",
			"claude-opus-4-20250514",
			"claude-sonnet-4-0",
			"claude-3-7-sonnet-latest",
		]) {
			expect(providerToolLoading("anthropic", modelId).type).toBe(
				"active-tools",
			);
		}
		expect(providerToolLoading("openai", "gpt-x").type).toBe("active-tools");
		expect(
			providerToolLoading("openai-compatible", "claude-opus-5-5").type,
		).toBe("active-tools");
	});

	test("an Anthropic reference names the tool", () => {
		const loading = providerToolLoading("anthropic", "claude-opus-5-5");

		expect(
			loading.type === "references" && loading.reference("getBot"),
		).toEqual({
			type: "custom",
			providerOptions: {
				anthropic: {
					type: "tool-reference",
					toolName: "getBot",
				},
			},
		});
	});
});

describe("listAnthropicModels", () => {
	const supported = (value: boolean) => ({
		supported: value,
	});

	test("maps every page of the Models API with the limits and capabilities it reports", async () => {
		const { fetch, requests } = fakeFetch(
			{
				data: [
					{
						type: "model",
						id: "claude-a",
						display_name: "Claude A",
						created_at: "2026-01-01T00:00:00Z",
						max_input_tokens: 1_000_000,
						max_tokens: 128_000,
						capabilities: {
							batch: supported(true),
							citations: supported(true),
							image_input: supported(true),
							pdf_input: supported(true),
							structured_outputs: supported(true),
							thinking: {
								supported: true,
								types: {
									adaptive: supported(true),
									enabled: supported(true),
								},
							},
						},
					},
					{
						type: "model",
						id: "claude-text",
						display_name: "Claude Text",
						created_at: "2026-01-01T00:00:00Z",
						capabilities: {
							image_input: supported(false),
							thinking: {
								supported: false,
								types: {},
							},
						},
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
				contextWindow: 1_000_000,
				maxOutputTokens: 128_000,
				capabilities: [
					"text",
					"image",
					"reasoning",
					"tool-calling",
				],
			},
			{
				providerModelId: "claude-text",
				name: "Claude Text",
				description: "Model ID: claude-text",
				contextWindow: null,
				maxOutputTokens: null,
				capabilities: [
					"text",
					"tool-calling",
				],
			},
			{
				providerModelId: "claude-b",
				name: "Claude B",
				description: "Model ID: claude-b",
				contextWindow: null,
				maxOutputTokens: null,
				capabilities: [
					"text",
					"tool-calling",
				],
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

describe("withholdToolCalls", () => {
	const requestBodyWithToolChoiceNone = async (kind: ModelProviderKind) => {
		const { fetch, requests } = fakeFetch();
		const model = createProviderLanguageModel(
			kind,
			{
				apiKey: "key",
				endpoint: "https://llm.example.org/v1",
				fetch,
			},
			"some-model",
		);
		await Promise.resolve(
			model.doGenerate({
				prompt,
				tools: [
					{
						type: "function",
						name: "search",
						inputSchema: {
							type: "object",
							properties: {},
						},
					},
				],
				toolChoice: {
					type: "none",
				},
			}),
		).catch(() => undefined);
		return requests[0]?.body as {
			tools?: unknown[];
		};
	};

	test("rules out tool calls only where the tool list stays in the request", async () => {
		for (const kind of modelProviderKinds) {
			const body = await requestBodyWithToolChoiceNone(kind);
			const keepsTools = (body.tools?.length ?? 0) > 0;

			expect(providerKindServerEntries[kind].toolChoiceNoneKeepsTools).toBe(
				keepsTools,
			);
			expect(withholdToolCalls(kind)).toEqual(
				keepsTools
					? {
							toolChoice: "none",
						}
					: {},
			);
		}
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

describe("providerCompaction", () => {
	/** What a call of `kind` with the compaction's options sends. */
	const sent = async (kind: ModelProviderKind, trigger: number) => {
		const { fetch, requests } = fakeFetch();
		const model = createProviderLanguageModel(
			kind,
			{
				apiKey: "key",
				endpoint: "https://llm.example.org/v1",
				fetch,
			},
			"some-model",
		);
		await Promise.resolve(
			model.doGenerate({
				prompt,
				providerOptions: providerCompaction(kind, trigger).providerOptions,
			}),
		).catch(() => undefined);
		const [request] = requests;
		return {
			body: request?.body as Record<string, unknown>,
			betas: request?.headers.get("anthropic-beta") ?? "",
		};
	};

	test("Anthropic compacts on its server at the trigger, with our instructions", async () => {
		const { body, betas } = await sent("anthropic", 80_000);

		expect(body.context_management).toEqual({
			edits: [
				expect.objectContaining({
					type: "compact_20260112",
					trigger: {
						type: "input_tokens",
						value: 80_000,
					},
					instructions: expect.stringContaining("call no tools"),
				}),
			],
		});
		expect(betas).toContain("compact-2026-01-12");
		expect(providerCompaction("anthropic", 80_000)).toMatchObject({
			native: true,
		});
	});

	test("Anthropic caches every call's prompt automatically, compacting or not", async () => {
		for (const trigger of [
			80_000,
			40_000,
		]) {
			const { body } = await sent("anthropic", trigger);

			expect(body.cache_control).toEqual({
				type: "ephemeral",
			});
		}
	});

	test("Anthropic below its 50000 minimum trigger falls back to our own summary", async () => {
		const compaction = providerCompaction("anthropic", 40_000);
		const { body } = await sent("anthropic", 40_000);

		expect(compaction.native).toBe(false);
		expect(body.context_management).toBeUndefined();
		expect(compaction.reads("summary")).toBe(true);
		expect(compaction.reads("anthropic")).toBe(false);
	});

	test("OpenAI compacts on its server and stores nothing there", async () => {
		const { body } = await sent("openai", 80_000);

		expect(body.store).toBe(false);
		expect(body.context_management).toEqual([
			{
				type: "compaction",
				compact_threshold: 80_000,
			},
		]);
	});

	test("OpenAI-compatible endpoints always get our own summary", () => {
		const compaction = providerCompaction("openai-compatible", 80_000);

		expect(compaction).toMatchObject({
			native: false,
			providerOptions: undefined,
		});
		expect(compaction.reads("openai")).toBe(false);
		expect(compaction.reads("summary")).toBe(true);
	});
});
