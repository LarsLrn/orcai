import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/** The models the mock serves; `GENERAL_MODEL` and `EMBEDDING_MODEL` point at them. */
export const INFERENCE_MOCK_MODELS = {
	chat: "e2e-mock-chat",
	embedding: "e2e-mock-embedding",
} as const;

/** Dimension of an embedding when neither the request nor an option says. */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

/** `owned_by` of every model the mock lists. */
const OWNER = "orcai-e2e";

/** The chat model's context window, reported the way vLLM does. */
export const INFERENCE_MOCK_CONTEXT_WINDOW = 32_768;

/** Fixed `created` timestamp, so two identical runs produce identical bodies. */
const CREATED = 1_700_000_000;

export type RecordedRequest = {
	method: string;
	/** Path including the `/v1` prefix, without the query string. */
	path: string;
	/** Parsed JSON body, or `undefined` when there was none. */
	body: unknown;
	/** The headers a spec asserts on. */
	headers: {
		authorization?: string;
		contentType?: string;
	};
};

export type ScriptedReply = {
	/** Assistant text to answer with instead of the echo. */
	text: string;
	/** Only answer requests for this model; omit for the default reply. */
	model?: string;
};

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| {
			[key: string]: JsonValue;
	  };

export type ScriptedToolCall = {
	name: string;
	/** Sent as `function.arguments`, serialized with `JSON.stringify`. */
	input: JsonValue;
	/** Defaults to `call_e2e_<n>`, counting up per mock. */
	id?: string;
};

/** One chat completion answer; `script` queues these. */
export type ScriptedStep = {
	/** Without `text` and `toolCalls` the step answers the standing reply. */
	text?: string;
	toolCalls?: ScriptedToolCall[];
	/** Defaults to `tool_calls` when the step has calls, else `stop`. */
	finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
	/**
	 * `response` sends nothing until `release()`; `end` streams every chunk and
	 * keeps the body open until `release()`, like `response` when not streaming.
	 */
	hold?: "response" | "end";
};

/** One page of a mock Tavily answer. */
export type SearchResult = {
	url: string;
	title: string;
	content: string;
};

export type ScriptedFailure = {
	status: number;
	message?: string;
	code?: string;
};

export type InferenceMockOptions = {
	/** 0, the default, takes an ephemeral port. */
	port?: number;
	host?: string;
	/** Fallback dimension when a request does not ask for one. */
	embeddingDimensions?: number;
	/** Answer 401 unless the request carries an `Authorization: Bearer` header. */
	requireApiKey?: boolean;
};

export type InferenceMock = {
	/** Base URL ending in `/v1`, ready for a provider `endpoint`. */
	url: string;
	/** Every request the mock received, oldest first. */
	requests: RecordedRequest[];
	/** Model ids the mock lists, in the order it lists them. */
	models: readonly string[];
	/** Answer chat completions with this text, for one model or for all. */
	respondWith: (reply: ScriptedReply) => void;
	/** Answer the next request with this error instead of a result. */
	failNext: (failure: ScriptedFailure) => void;
	/** Queue steps; each chat completion answers the next one. */
	script: (...steps: ScriptedStep[]) => void;
	/** Answer every Tavily search with these pages instead of the default one. */
	searchWith: (results: SearchResult[]) => void;
	/** Let every held response go. */
	release: () => void;
	/** Responses waiting for `release()`. */
	held: () => number;
	/** Requests the client closed before their response ended. */
	abandoned: () => number;
	/** Forget requests, replies, failures, and steps; destroy held responses. */
	reset: () => void;
	close: () => Promise<void>;
};

const errorBody = (
	message: string,
	code: string,
	type = "invalid_request_error",
) => ({
	error: {
		message,
		type,
		param: null,
		code,
	},
});

/** FNV-1a, so a vector stays the same across runs and processes. */
const hashOf = (input: string): number => {
	let hash = 2_166_136_261;

	for (let index = 0; index < input.length; index += 1) {
		hash = Math.imul(hash ^ input.charCodeAt(index), 16_777_619);
	}

	return hash >>> 0;
};

/** Values in [-1, 1), stable for the same input and dimension count. */
const embeddingFor = (input: string, dimensions: number): number[] =>
	Array.from(
		{
			length: dimensions,
		},
		(_unused, index) => {
			const mixed = Math.imul(hashOf(input) + index, 2_654_435_761) >>> 0;

			return Math.round((mixed / 2 ** 31 - 1) * 1_000_000) / 1_000_000;
		},
	);

/** Whitespace-separated words, close enough to a token count for assertions. */
const tokenCount = (text: string): number => {
	const words = text.trim().split(/\s+/).filter(Boolean);

	return words.length;
};

const textOfContent = (content: unknown): string => {
	if (typeof content === "string") {
		return content;
	}

	if (!Array.isArray(content)) {
		return "";
	}

	return content
		.map((part) =>
			typeof part === "object" &&
			part !== null &&
			"text" in part &&
			typeof part.text === "string"
				? part.text
				: "",
		)
		.filter(Boolean)
		.join(" ");
};

const lastUserText = (body: unknown): string => {
	if (
		typeof body !== "object" ||
		body === null ||
		!("messages" in body) ||
		!Array.isArray(body.messages)
	) {
		return "";
	}

	const users = body.messages.filter(
		(message: unknown) =>
			typeof message === "object" &&
			message !== null &&
			"role" in message &&
			message.role === "user",
	);

	const last = users.at(-1);

	return typeof last === "object" && last !== null && "content" in last
		? textOfContent(last.content).replaceAll(/\s+/g, " ").trim()
		: "";
};

const stringField = (body: unknown, field: string): string | undefined => {
	if (typeof body !== "object" || body === null || !(field in body)) {
		return undefined;
	}

	const value = (body as Record<string, unknown>)[field];

	return typeof value === "string" ? value : undefined;
};

const numberField = (body: unknown, field: string): number | undefined => {
	if (typeof body !== "object" || body === null || !(field in body)) {
		return undefined;
	}

	const value = (body as Record<string, unknown>)[field];

	return typeof value === "number" ? value : undefined;
};

const booleanField = (body: unknown, field: string): boolean => {
	if (typeof body !== "object" || body === null || !(field in body)) {
		return false;
	}

	return (body as Record<string, unknown>)[field] === true;
};

const wantsUsageChunk = (body: unknown): boolean => {
	if (
		typeof body !== "object" ||
		body === null ||
		!("stream_options" in body)
	) {
		return false;
	}

	return booleanField(body.stream_options, "include_usage");
};

/** Inputs of an embeddings request, both the single string and the array form. */
const embeddingInputs = (body: unknown): string[] => {
	if (typeof body !== "object" || body === null || !("input" in body)) {
		return [];
	}

	const { input } = body as {
		input: unknown;
	};

	if (typeof input === "string") {
		return [
			input,
		];
	}

	if (!Array.isArray(input)) {
		return [];
	}

	// Token-array inputs are stringified, not decoded; the app never sends them.
	return input.map((value) =>
		typeof value === "string" ? value : JSON.stringify(value),
	);
};

/** At least two pieces, so a streamed call is observably still arriving. */
const argumentPieces = (serialized: string): string[] => {
	if (serialized.length < 2) {
		return [
			"",
			serialized,
		];
	}

	const size = Math.min(8, Math.floor(serialized.length / 2));

	return Array.from(
		{
			length: Math.ceil(serialized.length / size),
		},
		(_unused, index) => serialized.slice(index * size, (index + 1) * size),
	);
};

const readBody = async (request: IncomingMessage): Promise<string> => {
	const chunks: Buffer[] = [];

	for await (const chunk of request) {
		chunks.push(chunk as Buffer);
	}

	return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (
	response: ServerResponse,
	status: number,
	payload: unknown,
): void => {
	const body = JSON.stringify(payload);

	response.writeHead(status, {
		"content-type": "application/json",
		"content-length": String(Buffer.byteLength(body)),
	});
	response.end(body);
};

/** A deterministic OpenAI-compatible server: fixed models, echoing chat, stable embeddings. */
export const startInferenceMock = async (
	options: InferenceMockOptions = {},
): Promise<InferenceMock> => {
	const host = options.host ?? "127.0.0.1";
	const fallbackDimensions =
		options.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;

	const requests: RecordedRequest[] = [];
	const failures: ScriptedFailure[] = [];
	const repliesByModel = new Map<string, string>();
	const steps: ScriptedStep[] = [];
	const holds = new Map<ServerResponse, () => void>();
	const closed = new WeakSet<ServerResponse>();
	const discarded = new WeakSet<ServerResponse>();
	let defaultReply: string | undefined;
	let searchResults: SearchResult[] | undefined;
	let completionCount = 0;
	let toolCallCount = 0;
	let abandonedCount = 0;

	const nextCompletionId = (): string => {
		completionCount += 1;

		return `chatcmpl-e2e-${String(completionCount)}`;
	};

	const nextToolCallId = (): string => {
		toolCallCount += 1;

		return `call_e2e_${String(toolCallCount)}`;
	};

	const replyFor = (model: string, prompt: string): string =>
		repliesByModel.get(model) ??
		defaultReply ??
		`Mock inference reply to: ${prompt || "(no user message)"}`;

	/** Resolves `true` on `release()`, `false` when the response closes first. */
	const holdUntilRelease = (response: ServerResponse): Promise<boolean> =>
		new Promise((resolve) => {
			if (closed.has(response)) {
				resolve(false);

				return;
			}

			holds.set(response, () => resolve(true));
			response.once("close", () => resolve(false));
		});

	const chatCompletion = async (
		body: unknown,
		response: ServerResponse,
	): Promise<void> => {
		const model = stringField(body, "model") ?? INFERENCE_MOCK_MODELS.chat;
		const prompt = lastUserText(body);
		const step = steps.shift() ?? {};
		const scriptedCalls = step.toolCalls ?? [];
		const text =
			step.text === undefined && scriptedCalls.length === 0
				? replyFor(model, prompt)
				: (step.text ?? "");
		const toolCalls = scriptedCalls.map((call) => ({
			id: call.id ?? nextToolCallId(),
			type: "function" as const,
			function: {
				name: call.name,
				arguments: JSON.stringify(call.input),
			},
		}));
		const finishReason =
			step.finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop");
		const id = nextCompletionId();
		const completionTokens = toolCalls.reduce(
			(total, call) => total + tokenCount(call.function.arguments),
			tokenCount(text),
		);
		const usage = {
			prompt_tokens: tokenCount(prompt),
			completion_tokens: completionTokens,
			total_tokens: tokenCount(prompt) + completionTokens,
		};
		const streaming = booleanField(body, "stream");

		if (
			(step.hold === "response" || (step.hold === "end" && !streaming)) &&
			!(await holdUntilRelease(response))
		) {
			return;
		}

		if (!streaming) {
			sendJson(response, 200, {
				id,
				object: "chat.completion",
				created: CREATED,
				model,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: toolCalls.length > 0 && text === "" ? null : text,
							...(toolCalls.length > 0
								? {
										tool_calls: toolCalls,
									}
								: {}),
						},
						logprobs: null,
						finish_reason: finishReason,
					},
				],
				usage,
			});

			return;
		}

		response.writeHead(200, {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		});

		const chunk = (delta: unknown, reason: string | null): void => {
			response.write(
				`data: ${JSON.stringify({
					id,
					object: "chat.completion.chunk",
					created: CREATED,
					model,
					choices: [
						{
							index: 0,
							delta,
							logprobs: null,
							finish_reason: reason,
						},
					],
				})}\n\n`,
			);
		};

		chunk(
			{
				role: "assistant",
				content: "",
			},
			null,
		);

		// One delta per word, whitespace kept, so the joined deltas equal `text`.
		for (const piece of text.split(/(?<=\s)/).filter(Boolean)) {
			chunk(
				{
					content: piece,
				},
				null,
			);
		}

		for (const [index, call] of toolCalls.entries()) {
			chunk(
				{
					tool_calls: [
						{
							index,
							id: call.id,
							type: call.type,
							function: {
								name: call.function.name,
								arguments: "",
							},
						},
					],
				},
				null,
			);

			for (const piece of argumentPieces(call.function.arguments)) {
				chunk(
					{
						tool_calls: [
							{
								index,
								function: {
									arguments: piece,
								},
							},
						],
					},
					null,
				);
			}
		}

		chunk({}, finishReason);

		if (wantsUsageChunk(body)) {
			response.write(
				`data: ${JSON.stringify({
					id,
					object: "chat.completion.chunk",
					created: CREATED,
					model,
					choices: [],
					usage,
				})}\n\n`,
			);
		}

		response.write("data: [DONE]\n\n");

		if (step.hold === "end" && !(await holdUntilRelease(response))) {
			return;
		}

		response.end();
	};

	const embeddings = (body: unknown, response: ServerResponse): void => {
		const model = stringField(body, "model") ?? INFERENCE_MOCK_MODELS.embedding;
		const dimensions = numberField(body, "dimensions") ?? fallbackDimensions;
		const inputs = embeddingInputs(body);
		const promptTokens = inputs.reduce(
			(total, input) => total + tokenCount(input),
			0,
		);

		sendJson(response, 200, {
			object: "list",
			model,
			data: inputs.map((input, index) => ({
				object: "embedding",
				index,
				embedding: embeddingFor(input, dimensions),
			})),
			usage: {
				prompt_tokens: promptTokens,
				total_tokens: promptTokens,
			},
		});
	};

	/** Tavily's answer: the scripted pages, else one page on the first included domain. */
	const search = (body: unknown, response: ServerResponse): void => {
		const query = stringField(body, "query") ?? "";
		const domains =
			typeof body === "object" &&
			body !== null &&
			"include_domains" in body &&
			Array.isArray(body.include_domains)
				? body.include_domains.filter(
						(domain): domain is string => typeof domain === "string",
					)
				: [];
		const host = domains[0] ?? "example.org";
		const results = searchResults ?? [
			{
				url: `https://${host}/search-result`,
				title: `Mock search result for ${query}`,
				content: `Mock search content about ${query}.`,
			},
		];

		sendJson(response, 200, {
			query,
			answer: null,
			images: [],
			results: results.map((result) => ({
				...result,
				score: 0.9,
				raw_content: null,
			})),
			response_time: 0.01,
			request_id: "e2e-search",
		});
	};

	const models = (response: ServerResponse): void => {
		sendJson(response, 200, {
			object: "list",
			data: Object.values(INFERENCE_MOCK_MODELS).map((id) => ({
				id,
				object: "model",
				created: CREATED,
				owned_by: OWNER,
				...(id === INFERENCE_MOCK_MODELS.chat && {
					max_model_len: INFERENCE_MOCK_CONTEXT_WINDOW,
				}),
			})),
		});
	};

	const handle = async (
		request: IncomingMessage,
		response: ServerResponse,
	): Promise<void> => {
		response.on("close", () => {
			closed.add(response);
			holds.delete(response);

			if (!response.writableEnded && !discarded.has(response)) {
				abandonedCount += 1;
			}
		});

		const path = new URL(request.url ?? "/", `http://${host}`).pathname;
		const raw = await readBody(request);

		let body: unknown;

		try {
			body = raw.length > 0 ? JSON.parse(raw) : undefined;
		} catch {
			body = raw;
		}

		requests.push({
			method: request.method ?? "GET",
			path,
			body,
			headers: {
				authorization: request.headers.authorization,
				contentType: request.headers["content-type"],
			},
		});

		const failure = failures.shift();

		if (failure) {
			sendJson(
				response,
				failure.status,
				errorBody(
					failure.message ?? `Injected failure ${String(failure.status)}`,
					failure.code ?? "injected_failure",
				),
			);

			return;
		}

		const bearer = request.headers.authorization ?? "";

		if (options.requireApiKey && !bearer.startsWith("Bearer ")) {
			sendJson(
				response,
				401,
				errorBody(
					"Missing an Authorization: Bearer header.",
					"invalid_api_key",
					"invalid_request_error",
				),
			);

			return;
		}

		if (path === "/v1/models" && request.method === "GET") {
			models(response);

			return;
		}

		if (path === "/v1/chat/completions" && request.method === "POST") {
			await chatCompletion(body, response);

			return;
		}

		if (path === "/v1/search" && request.method === "POST") {
			search(body, response);

			return;
		}

		if (path === "/v1/embeddings" && request.method === "POST") {
			embeddings(body, response);

			return;
		}

		sendJson(
			response,
			404,
			errorBody(
				`Unknown route ${request.method ?? "GET"} ${path}.`,
				"unknown_route",
			),
		);
	};

	const server: Server = createServer((request, response) => {
		handle(request, response).catch((cause: unknown) => {
			// Headers are out, so cutting the connection is the only error signal left.
			if (response.headersSent) {
				response.destroy();

				return;
			}

			sendJson(response, 500, errorBody(String(cause), "mock_failure"));
		});
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port ?? 0, host, () => {
			server.off("error", reject);
			resolve();
		});
	});

	const address = server.address() as AddressInfo;

	return {
		url: `http://${host}:${String(address.port)}/v1`,
		requests,
		models: Object.values(INFERENCE_MOCK_MODELS),
		respondWith: (reply) => {
			if (reply.model === undefined) {
				defaultReply = reply.text;

				return;
			}

			repliesByModel.set(reply.model, reply.text);
		},
		failNext: (failure) => {
			failures.push(failure);
		},
		script: (...scripted) => {
			steps.push(...scripted);
		},
		searchWith: (results) => {
			searchResults = results;
		},
		release: () => {
			const resumes = [
				...holds.values(),
			];

			holds.clear();

			for (const resume of resumes) {
				resume();
			}
		},
		held: () => holds.size,
		abandoned: () => abandonedCount,
		reset: () => {
			for (const response of holds.keys()) {
				discarded.add(response);
				response.destroy();
			}

			holds.clear();
			requests.length = 0;
			failures.length = 0;
			steps.length = 0;
			repliesByModel.clear();
			defaultReply = undefined;
			searchResults = undefined;
			completionCount = 0;
			toolCallCount = 0;
			abandonedCount = 0;
		},
		close: async () => {
			if (!server.listening) {
				return;
			}

			await new Promise<void>((resolve, reject) => {
				server.close((cause) => {
					if (cause) {
						reject(cause);

						return;
					}

					resolve();
				});

				server.closeAllConnections();
			});
		},
	};
};
