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
	/** Forget recorded requests, scripted replies, and scripted failures. */
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
	let defaultReply: string | undefined;
	let completionCount = 0;

	const nextCompletionId = (): string => {
		completionCount += 1;

		return `chatcmpl-e2e-${String(completionCount)}`;
	};

	const replyFor = (model: string, prompt: string): string =>
		repliesByModel.get(model) ??
		defaultReply ??
		`Mock inference reply to: ${prompt || "(no user message)"}`;

	const chatCompletion = (body: unknown, response: ServerResponse): void => {
		const model = stringField(body, "model") ?? INFERENCE_MOCK_MODELS.chat;
		const prompt = lastUserText(body);
		const text = replyFor(model, prompt);
		const id = nextCompletionId();
		const usage = {
			prompt_tokens: tokenCount(prompt),
			completion_tokens: tokenCount(text),
			total_tokens: tokenCount(prompt) + tokenCount(text),
		};

		if (!booleanField(body, "stream")) {
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
							content: text,
						},
						logprobs: null,
						finish_reason: "stop",
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

		const chunk = (delta: unknown, finishReason: string | null): void => {
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
							finish_reason: finishReason,
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
		for (const piece of text.split(/(?<=\s)/)) {
			chunk(
				{
					content: piece,
				},
				null,
			);
		}

		chunk({}, "stop");

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

	const models = (response: ServerResponse): void => {
		sendJson(response, 200, {
			object: "list",
			data: Object.values(INFERENCE_MOCK_MODELS).map((id) => ({
				id,
				object: "model",
				created: CREATED,
				owned_by: OWNER,
			})),
		});
	};

	const handle = async (
		request: IncomingMessage,
		response: ServerResponse,
	): Promise<void> => {
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
			chatCompletion(body, response);

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
		reset: () => {
			requests.length = 0;
			failures.length = 0;
			repliesByModel.clear();
			defaultReply = undefined;
			completionCount = 0;
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
