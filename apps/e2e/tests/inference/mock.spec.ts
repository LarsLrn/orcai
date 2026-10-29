import { untilAllowed } from "../../fixtures/authorization";
import {
	DEFAULT_EMBEDDING_DIMENSIONS,
	expect,
	INFERENCE_MOCK_CONTEXT_WINDOW,
	INFERENCE_MOCK_MODELS,
	startInferenceMock,
	test,
} from "../../fixtures/inference/fixture";

const jsonPost = async (url: string, body: unknown, signal?: AbortSignal) =>
	await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer e2e-mock-key",
		},
		body: JSON.stringify(body),
		signal,
	});

const ask = (content: string, stream = false) => ({
	model: INFERENCE_MOCK_MODELS.chat,
	stream,
	stream_options: stream
		? {
				include_usage: true,
			}
		: undefined,
	messages: [
		{
			role: "user",
			content,
		},
	],
});

type StreamedChunk = {
	choices: {
		delta?: {
			content?: string;
			tool_calls?: {
				index: number;
				id?: string;
				type?: string;
				function: {
					name?: string;
					arguments: string;
				};
			}[];
		};
		finish_reason: string | null;
	}[];
	usage?: {
		completion_tokens: number;
		total_tokens: number;
	};
};

const streamedChunks = (body: string): StreamedChunk[] =>
	body
		.split("\n\n")
		.map((event) => event.replace(/^data: /, "").trim())
		.filter((event) => event.length > 0 && event !== "[DONE]")
		.map((event) => JSON.parse(event) as StreamedChunk);

type Completion = {
	choices: {
		message: {
			content: string | null;
			tool_calls?: {
				id: string;
				type: string;
				function: {
					name: string;
					arguments: string;
				};
			}[];
		};
		finish_reason: string;
	}[];
	usage: {
		completion_tokens: number;
	};
};

const completionOf = async (response: Response): Promise<Completion> =>
	(await response.json()) as Completion;

const contentOf = async (response: Response): Promise<string | null> =>
	(await completionOf(response)).choices[0].message.content;

const finishReasons = (chunks: StreamedChunk[]): string[] =>
	chunks
		.flatMap((chunk) => chunk.choices)
		.flatMap((choice) =>
			choice.finish_reason
				? [
						choice.finish_reason,
					]
				: [],
		);

test("the inference mock lists its models", async ({ inference }) => {
	inference.reset();

	const response = await fetch(`${inference.url}/models`, {
		headers: {
			authorization: "Bearer e2e-mock-key",
		},
	});

	expect(response.status).toBe(200);

	const payload = (await response.json()) as {
		object: string;
		data: {
			id: string;
			owned_by: string;
		}[];
	};

	expect(payload.object).toBe("list");
	expect(payload.data.map((model) => model.id)).toEqual([
		INFERENCE_MOCK_MODELS.chat,
		INFERENCE_MOCK_MODELS.embedding,
	]);

	expect(inference.requests.at(-1)).toMatchObject({
		method: "GET",
		path: "/v1/models",
		headers: {
			authorization: "Bearer e2e-mock-key",
		},
	});
});

test("the inference mock echoes a chat completion", async ({ inference }) => {
	inference.reset();

	const response = await jsonPost(`${inference.url}/chat/completions`, {
		model: INFERENCE_MOCK_MODELS.chat,
		messages: [
			{
				role: "system",
				content: "You are a helpful assistant.",
			},
			{
				role: "user",
				content: "Ping the mock",
			},
		],
	});

	expect(response.status).toBe(200);

	const payload = (await response.json()) as {
		model: string;
		choices: {
			message: {
				content: string;
			};
			finish_reason: string;
		}[];
		usage: {
			total_tokens: number;
		};
	};

	expect(payload.model).toBe(INFERENCE_MOCK_MODELS.chat);
	expect(payload.choices[0].message.content).toBe(
		"Mock inference reply to: Ping the mock",
	);
	expect(payload.choices[0].finish_reason).toBe("stop");
	expect(payload.usage.total_tokens).toBeGreaterThan(0);

	expect(inference.requests.at(-1)).toMatchObject({
		method: "POST",
		path: "/v1/chat/completions",
	});
});

test("the inference mock answers a scripted reply", async ({ inference }) => {
	inference.reset();
	inference.respondWith({
		text: "Scripted answer",
	});

	const response = await jsonPost(`${inference.url}/chat/completions`, {
		model: INFERENCE_MOCK_MODELS.chat,
		messages: [
			{
				role: "user",
				content: "Anything",
			},
		],
	});

	const payload = (await response.json()) as {
		choices: {
			message: {
				content: string;
			};
		}[];
	};

	expect(payload.choices[0].message.content).toBe("Scripted answer");

	inference.reset();

	const afterReset = await jsonPost(`${inference.url}/chat/completions`, {
		model: INFERENCE_MOCK_MODELS.chat,
		messages: [
			{
				role: "user",
				content: "Anything",
			},
		],
	});

	expect(
		(
			(await afterReset.json()) as {
				choices: {
					message: {
						content: string;
					};
				}[];
			}
		).choices[0].message.content,
	).toBe("Mock inference reply to: Anything");
});

test("the inference mock streams a chat completion", async ({ inference }) => {
	inference.reset();

	const response = await jsonPost(`${inference.url}/chat/completions`, {
		model: INFERENCE_MOCK_MODELS.chat,
		stream: true,
		stream_options: {
			include_usage: true,
		},
		messages: [
			{
				role: "user",
				content: "Stream to me",
			},
		],
	});

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toContain("text/event-stream");

	const body = await response.text();

	expect(body).toContain("data: [DONE]");

	const events = streamedChunks(body);

	const text = events
		.flatMap((event) => event.choices)
		.map((choice) => choice.delta?.content ?? "")
		.join("");

	expect(text).toBe("Mock inference reply to: Stream to me");
	expect(finishReasons(events)).toEqual([
		"stop",
	]);
	expect(events.at(-1)?.usage?.total_tokens).toBeGreaterThan(0);
});

test("the inference mock answers scripted steps in order, then falls back", async ({
	inference,
}) => {
	inference.reset();
	inference.respondWith({
		text: "Standing reply",
	});
	inference.script(
		{
			text: "First step",
		},
		{
			text: "Second step",
		},
	);
	inference.failNext({
		status: 500,
	});

	const url = `${inference.url}/chat/completions`;

	expect((await jsonPost(url, ask("One"))).status).toBe(500);
	expect(await contentOf(await jsonPost(url, ask("Two")))).toBe("First step");
	expect(await contentOf(await jsonPost(url, ask("Three")))).toBe(
		"Second step",
	);
	expect(await contentOf(await jsonPost(url, ask("Four")))).toBe(
		"Standing reply",
	);

	inference.reset();
	inference.script({});

	expect(await contentOf(await jsonPost(url, ask("Five")))).toBe(
		"Mock inference reply to: Five",
	);
	expect(await contentOf(await jsonPost(url, ask("Six")))).toBe(
		"Mock inference reply to: Six",
	);
});

test("the inference mock streams scripted text and tool calls", async ({
	inference,
}) => {
	inference.reset();

	const lookup = {
		query: "quarterly report",
		limit: 3,
	};
	const notify = [
		"alice",
		"bob",
	];

	inference.script({
		text: "Let me check.",
		toolCalls: [
			{
				name: "lookup",
				input: lookup,
			},
			{
				name: "notify",
				input: notify,
				id: "call_given",
			},
		],
	});

	const response = await jsonPost(
		`${inference.url}/chat/completions`,
		ask("Use tools", true),
	);
	const body = await response.text();
	const chunks = streamedChunks(body);
	const deltas = chunks.flatMap((chunk) =>
		chunk.choices.map((choice) => choice.delta ?? {}),
	);
	const firstCall = deltas.findIndex((delta) => delta.tool_calls);

	expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
	expect(
		deltas
			.slice(0, firstCall)
			.map((delta) => delta.content ?? "")
			.join(""),
	).toBe("Let me check.");
	expect(
		deltas.slice(firstCall).every((delta) => delta.content === undefined),
	).toBe(true);

	const calls = deltas
		.slice(firstCall)
		.flatMap((delta) => delta.tool_calls ?? []);

	expect(calls.every((call) => typeof call.function === "object")).toBe(true);
	expect([
		...new Set(calls.map((call) => call.index)),
	]).toEqual([
		0,
		1,
	]);

	for (const [index, expected] of [
		{
			id: "call_e2e_1",
			name: "lookup",
			input: lookup,
		},
		{
			id: "call_given",
			name: "notify",
			input: notify,
		},
	].entries()) {
		const [first, ...rest] = calls.filter((call) => call.index === index);

		expect(first).toEqual({
			index,
			id: expected.id,
			type: "function",
			function: {
				name: expected.name,
				arguments: "",
			},
		});
		expect(rest.length).toBeGreaterThanOrEqual(2);
		expect(rest.every((call) => call.id === undefined)).toBe(true);
		expect(rest.map((call) => call.function.arguments).join("")).toBe(
			JSON.stringify(expected.input),
		);
	}

	expect(finishReasons(chunks)).toEqual([
		"tool_calls",
	]);
	// Three words of text, two in the first arguments, one in the second.
	expect(chunks.at(-1)?.usage?.completion_tokens).toBe(6);
});

test("the inference mock answers scripted tool calls without streaming", async ({
	inference,
}) => {
	inference.reset();
	inference.script(
		{
			toolCalls: [
				{
					name: "lookup",
					input: {
						query: "one",
					},
				},
			],
		},
		{
			text: "Cut short",
			toolCalls: [
				{
					name: "lookup",
					input: {
						query: "two",
					},
					id: "call_given",
				},
			],
			finishReason: "length",
		},
	);

	const url = `${inference.url}/chat/completions`;
	const first = await completionOf(await jsonPost(url, ask("One")));

	expect(first.choices[0]).toEqual({
		index: 0,
		message: {
			role: "assistant",
			content: null,
			tool_calls: [
				{
					id: "call_e2e_1",
					type: "function",
					function: {
						name: "lookup",
						arguments: '{"query":"one"}',
					},
				},
			],
		},
		logprobs: null,
		finish_reason: "tool_calls",
	});
	expect(first.usage.completion_tokens).toBe(1);

	const second = await completionOf(await jsonPost(url, ask("Two")));

	expect(second.choices[0].message.content).toBe("Cut short");
	expect(second.choices[0].message.tool_calls?.[0].id).toBe("call_given");
	expect(second.choices[0].finish_reason).toBe("length");

	inference.script({
		text: "Overridden",
		finishReason: "content_filter",
	});

	const streamed = streamedChunks(
		await (await jsonPost(url, ask("Three", true))).text(),
	);

	expect(finishReasons(streamed)).toEqual([
		"content_filter",
	]);
});

test("the inference mock holds a response until release", async ({
	inference,
}) => {
	inference.reset();
	inference.script({
		text: "Held reply",
		hold: "response",
	});

	let answered = false;
	const pending = jsonPost(
		`${inference.url}/chat/completions`,
		ask("Hold me"),
	).then((response) => {
		answered = true;

		return response;
	});

	await expect.poll(() => inference.held()).toBe(1);
	expect(answered).toBe(false);
	expect(inference.requests.at(-1)).toMatchObject({
		method: "POST",
		path: "/v1/chat/completions",
	});

	inference.release();

	expect(await contentOf(await pending)).toBe("Held reply");
	expect(inference.held()).toBe(0);
});

test("the inference mock holds the end of a stream until release", async ({
	inference,
}) => {
	inference.reset();
	inference.script({
		toolCalls: [
			{
				name: "lookup",
				input: {
					query: "open",
				},
			},
		],
		hold: "end",
	});

	const response = await jsonPost(
		`${inference.url}/chat/completions`,
		ask("Keep it open", true),
	);
	const reader = response.body?.getReader();

	if (!reader) {
		throw new Error("Missing response body");
	}

	const decoder = new TextDecoder();
	let body = "";

	while (!body.includes("data: [DONE]")) {
		const { value } = await reader.read();

		body += decoder.decode(value, {
			stream: true,
		});
	}

	expect(inference.held()).toBe(1);

	let ended = false;
	const end = reader.read().then((result) => {
		ended = true;

		return result;
	});

	await expect.poll(() => inference.held()).toBe(1);
	expect(ended).toBe(false);

	inference.release();

	expect((await end).done).toBe(true);
	expect(inference.held()).toBe(0);
	expect(inference.abandoned()).toBe(0);
});

test("the inference mock counts a held request the client abandons", async ({
	inference,
}) => {
	inference.reset();
	inference.script({
		hold: "response",
	});

	const controller = new AbortController();
	const pending = jsonPost(
		`${inference.url}/chat/completions`,
		ask("Never mind"),
		controller.signal,
	).catch((cause: unknown) => cause);

	await expect.poll(() => inference.held()).toBe(1);
	controller.abort();

	expect(await pending).toBeInstanceOf(Error);
	await expect.poll(() => inference.abandoned()).toBe(1);
	expect(inference.held()).toBe(0);
});

test("the inference mock reset drops queued steps and held responses", async ({
	inference,
}) => {
	inference.reset();
	inference.script(
		{
			hold: "response",
		},
		{
			text: "Queued step",
		},
	);

	const url = `${inference.url}/chat/completions`;
	const pending = jsonPost(url, ask("Held")).catch((cause: unknown) => cause);

	await expect.poll(() => inference.held()).toBe(1);
	inference.reset();

	expect(await pending).toBeInstanceOf(Error);
	expect(inference.held()).toBe(0);
	expect(inference.abandoned()).toBe(0);
	expect(await contentOf(await jsonPost(url, ask("After reset")))).toBe(
		"Mock inference reply to: After reset",
	);
});

test("the inference mock embeds a string and an array", async ({
	inference,
}) => {
	inference.reset();

	const single = await jsonPost(`${inference.url}/embeddings`, {
		model: INFERENCE_MOCK_MODELS.embedding,
		input: "one document",
	});

	const singlePayload = (await single.json()) as {
		data: {
			index: number;
			embedding: number[];
		}[];
		usage: {
			total_tokens: number;
		};
	};

	expect(singlePayload.data).toHaveLength(1);
	expect(singlePayload.data[0].embedding).toHaveLength(
		DEFAULT_EMBEDDING_DIMENSIONS,
	);
	expect(singlePayload.usage.total_tokens).toBeGreaterThan(0);

	const many = await jsonPost(`${inference.url}/embeddings`, {
		model: INFERENCE_MOCK_MODELS.embedding,
		dimensions: 8,
		input: [
			"one document",
			"another document",
		],
	});

	const manyPayload = (await many.json()) as {
		data: {
			embedding: number[];
		}[];
	};

	expect(manyPayload.data).toHaveLength(2);
	expect(manyPayload.data[0].embedding).toHaveLength(8);
	// Deterministic: the same input yields the same vector, a different input
	// a different one.
	expect(manyPayload.data[0].embedding).not.toEqual(
		manyPayload.data[1].embedding,
	);
	expect(
		(
			(await (
				await jsonPost(`${inference.url}/embeddings`, {
					model: INFERENCE_MOCK_MODELS.embedding,
					dimensions: 8,
					input: "one document",
				})
			).json()) as {
				data: {
					embedding: number[];
				}[];
			}
		).data[0].embedding,
	).toEqual(manyPayload.data[0].embedding);
});

test("the inference mock injects an error for one request", async ({
	inference,
}) => {
	inference.reset();
	inference.failNext({
		status: 500,
		message: "Injected upstream failure",
	});

	const failing = await fetch(`${inference.url}/models`);

	expect(failing.status).toBe(500);
	expect(
		(
			(await failing.json()) as {
				error: {
					message: string;
				};
			}
		).error.message,
	).toBe("Injected upstream failure");

	// Only the next request fails.
	expect((await fetch(`${inference.url}/models`)).status).toBe(200);
});

test("the inference mock answers an unknown route with 404", async ({
	inference,
}) => {
	inference.reset();

	const response = await fetch(`${inference.url}/completions`);

	expect(response.status).toBe(404);
	expect(
		(
			(await response.json()) as {
				error: {
					code: string;
					type: string;
				};
			}
		).error,
	).toMatchObject({
		code: "unknown_route",
		type: "invalid_request_error",
	});
});

test("the inference mock guards its endpoints when a key is required", async () => {
	const guarded = await startInferenceMock({
		requireApiKey: true,
	});

	try {
		expect((await fetch(`${guarded.url}/models`)).status).toBe(401);
		expect(
			(
				await fetch(`${guarded.url}/models`, {
					headers: {
						authorization: "Bearer any-key",
					},
				})
			).status,
		).toBe(200);
	} finally {
		await guarded.close();
	}
});

test("the app discovers the inference mock's models through a provider", async ({
	api,
	inference,
}) => {
	inference.reset();

	const apiKey = "e2e-mock-provider-key";

	// The `org` fixture's admin joined through the sign-up hook, whose grant no
	// response announces. A refused create wrote nothing, so repeating is safe.
	const created = await untilAllowed(() =>
		api.as("admin").provider.create({
			name: `E2E Inference Mock ${String(Date.now())}`,
			description: "Mock OpenAI-compatible endpoint for the e2e suite.",
			endpoint: inference.url,
			kind: "openai-compatible",
			meteringMode: "tokens",
			apiKey,
			enabled: true,
		}),
	);

	const createdProviderId = created.data.id;

	const discovered = await api.as("admin").model.discover({
		providerId: createdProviderId,
	});

	expect(discovered.data.foundCount).toBe(inference.models.length);
	expect(discovered.data.addedCount).toBe(inference.models.length);

	const listed = await api.as("admin").model.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			providerId: createdProviderId,
		},
	});

	expect(listed.data.map((model) => model.providerModelId).sort()).toEqual(
		[
			...inference.models,
		].sort(),
	);
	expect(listed.data.map((model) => model.capabilities)).toEqual(
		inference.models.map(() => null),
	);

	const limitsOf = (models: typeof listed.data) =>
		Object.fromEntries(
			models.map((model) => [
				model.providerModelId,
				{
					contextWindow: model.contextWindow,
					maxOutputTokens: model.maxOutputTokens,
				},
			]),
		);

	expect(limitsOf(listed.data)).toEqual({
		[INFERENCE_MOCK_MODELS.chat]: {
			contextWindow: INFERENCE_MOCK_CONTEXT_WINDOW,
			maxOutputTokens: null,
		},
		[INFERENCE_MOCK_MODELS.embedding]: {
			contextWindow: null,
			maxOutputTokens: null,
		},
	});

	const discovery = inference.requests.find(
		(request) => request.path === "/v1/models",
	);

	expect(discovery).toBeDefined();
	expect(discovery?.headers.authorization).toBe(`Bearer ${apiKey}`);
});

test("rediscovery fills the limits a model lacks and keeps edited ones", async ({
	api,
	inference,
}) => {
	const admin = api.as("admin");
	const created = await untilAllowed(() =>
		admin.provider.create({
			name: `E2E Inference Mock ${String(Date.now())}`,
			description: "Mock OpenAI-compatible endpoint for the e2e suite.",
			endpoint: inference.url,
			kind: "openai-compatible",
			meteringMode: "tokens",
			apiKey: "e2e-mock-provider-key",
			enabled: true,
		}),
	);
	const providerId = created.data.id;
	const chatModel = async () => {
		const listed = await admin.model.list({
			pageIndex: 0,
			pageSize: 100,
			filters: {
				providerId,
			},
		});
		const model = listed.data.find(
			({ providerModelId }) => providerModelId === INFERENCE_MOCK_MODELS.chat,
		);
		if (!model) throw new Error("Missing mock chat model");
		return model;
	};

	await admin.model.discover({
		providerId,
	});
	const { id } = await chatModel();

	await admin.model.update({
		id,
		contextWindow: null,
		maxOutputTokens: 4_096,
	});
	const rediscovered = await admin.model.discover({
		providerId,
	});

	expect(rediscovered.data).toEqual({
		foundCount: inference.models.length,
		addedCount: 0,
		alreadyExistedCount: inference.models.length,
		capabilitiesUnsetCount: 0,
	});
	expect(await chatModel()).toMatchObject({
		contextWindow: INFERENCE_MOCK_CONTEXT_WINDOW,
		maxOutputTokens: 4_096,
	});

	await admin.model.update({
		id,
		contextWindow: 8_192,
	});
	await admin.model.discover({
		providerId,
	});

	expect(await chatModel()).toMatchObject({
		contextWindow: 8_192,
		maxOutputTokens: 4_096,
	});
});
