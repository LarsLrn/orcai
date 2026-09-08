import { untilAllowed } from "../../fixtures/authorization";
import {
	DEFAULT_EMBEDDING_DIMENSIONS,
	expect,
	INFERENCE_MOCK_MODELS,
	startInferenceMock,
	test,
} from "../../fixtures/inference/fixture";

const jsonPost = async (url: string, body: unknown, apiKey = "e2e-mock-key") =>
	await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
	});

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

	const events = body
		.split("\n\n")
		.map((event) => event.replace(/^data: /, "").trim())
		.filter((event) => event.length > 0 && event !== "[DONE]")
		.map(
			(event) =>
				JSON.parse(event) as {
					object: string;
					choices: {
						delta?: {
							content?: string;
						};
						finish_reason: string | null;
					}[];
					usage?: {
						total_tokens: number;
					};
				},
		);

	const text = events
		.flatMap((event) => event.choices)
		.map((choice) => choice.delta?.content ?? "")
		.join("");

	expect(text).toBe("Mock inference reply to: Stream to me");
	expect(
		events
			.flatMap((event) => event.choices)
			.map((choice) => choice.finish_reason),
	).toContain("stop");
	expect(events.at(-1)?.usage?.total_tokens).toBeGreaterThan(0);
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
			compatibility: "openai",
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

	const discovery = inference.requests.find(
		(request) => request.path === "/v1/models",
	);

	expect(discovery).toBeDefined();
	expect(discovery?.headers.authorization).toBe(`Bearer ${apiKey}`);
});
