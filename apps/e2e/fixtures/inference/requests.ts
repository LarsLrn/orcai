import type { InferenceMock } from "@orcai/ai/testing";

type CompletionToolCall = {
	id: string;
	type: "function";
	function: {
		name: string;
		/** JSON text. */
		arguments: string;
	};
};

export type CompletionMessage = {
	role: "system" | "user" | "assistant" | "tool";
	/** Text, content parts, or null for an assistant message of only tool calls. */
	content: unknown;
	tool_call_id?: string;
	tool_calls?: CompletionToolCall[];
};

/** A chat completion request in the OpenAI format the app sends, as far as specs read it. */
export type CompletionRequest = {
	model: string;
	stream?: boolean;
	tool_choice?: unknown;
	tools?: {
		type: "function";
		function: {
			name: string;
		};
	}[];
	messages: CompletionMessage[];
	/** Generation settings such as `temperature`. */
	[setting: string]: unknown;
};

const isCompletionRequest = (body: unknown): body is CompletionRequest =>
	typeof body === "object" &&
	body !== null &&
	"model" in body &&
	typeof body.model === "string" &&
	"messages" in body &&
	Array.isArray(body.messages);

/** The chat completion requests the mock received, oldest first. */
export const completionRequests = (
	inference: InferenceMock,
): CompletionRequest[] =>
	inference.requests
		.filter(
			(request) =>
				request.method === "POST" && request.path === "/v1/chat/completions",
		)
		.map(({ body }) => {
			if (!isCompletionRequest(body)) {
				throw new Error(
					`Not a chat completion request: ${JSON.stringify(body)}`,
				);
			}

			return body;
		});

/** The streamed completion requests of turns; title generation does not stream. */
export const turnRequests = (inference: InferenceMock): CompletionRequest[] =>
	completionRequests(inference).filter((request) => request.stream === true);

/** The searches the mock answered, with their headers, oldest first. */
export const searchRequests = (inference: InferenceMock) =>
	inference.requests.filter(
		(request) => request.method === "POST" && request.path === "/v1/search",
	);

const textOf = (content: unknown): string => {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	return content
		.map((part: unknown) =>
			typeof part === "object" &&
			part !== null &&
			"text" in part &&
			typeof part.text === "string"
				? part.text
				: "",
		)
		.join("");
};

/** The user and assistant turns of a request, without the system prompt. */
export const conversationOf = (
	request: CompletionRequest | undefined,
): {
	role: "user" | "assistant";
	text: string;
}[] =>
	(request?.messages ?? []).flatMap(({ role, content }) =>
		role === "user" || role === "assistant"
			? [
					{
						role,
						text: textOf(content),
					},
				]
			: [],
	);

/** The system message a request starts with. */
export const systemPromptOf = (
	request: CompletionRequest | undefined,
): string =>
	textOf(request?.messages.find(({ role }) => role === "system")?.content);

/** The names of the tools a request offers. */
export const offeredTools = (
	request: CompletionRequest | undefined,
): string[] => (request?.tools ?? []).map((tool) => tool.function.name);

const callsOf = (request: CompletionRequest | undefined) =>
	(request?.messages ?? []).flatMap((message) => message.tool_calls ?? []);

/** The names of the tool calls a request's history carries, oldest first. */
export const historyToolCalls = (
	request: CompletionRequest | undefined,
): string[] => callsOf(request).map((call) => call.function.name);

/** The contents of a request's tool messages, oldest first. */
export const toolResults = (request: CompletionRequest | undefined): string[] =>
	(request?.messages ?? []).flatMap(({ role, content }) =>
		role === "tool"
			? [
					textOf(content),
				]
			: [],
	);

/** The content of the tool message that answers a call. */
export const toolResultFor = (
	request: CompletionRequest | undefined,
	callId: string | undefined,
): string | undefined => {
	const message = request?.messages.find(
		(entry) => entry.role === "tool" && entry.tool_call_id === callId,
	);

	return message && textOf(message.content);
};

/** The parsed arguments of a request's newest call of a tool. */
export const lastCallInput = (
	request: CompletionRequest | undefined,
	name: string,
): unknown => {
	const call = callsOf(request)
		.filter((entry) => entry.function.name === name)
		.at(-1);

	return call && JSON.parse(call.function.arguments);
};
