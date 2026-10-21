import type { ProviderKind } from "@orcai/core";
import type { OrganizationCapability } from "@orcai/schema";

export type ToolCall = {
	name: string;
	input: unknown;
};
/** One scripted model response. */
export type Step = {
	reasoning?: string;
	text?: string;
	calls?: ToolCall[];
};

export type Body = Record<string, unknown>;

type IdentifiedCall = ToolCall & {
	id: string;
};
type Reply = Omit<Step, "calls"> & {
	calls: IdentifiedCall[];
};

let callCount = 0;

const identify = ({ calls = [], ...step }: Step, prefix: string): Reply => ({
	...step,
	calls: calls.map((call) => ({
		...call,
		id: `${prefix}_${++callCount}`,
	})),
});

const anthropicReply = ({ reasoning, text, calls }: Reply) => ({
	id: "msg",
	type: "message",
	role: "assistant",
	model: "claude",
	content: [
		...(reasoning
			? [
					{
						type: "thinking",
						thinking: reasoning,
						// Binds the reasoning to what came before it.
						signature: `signed:${reasoning}`,
					},
				]
			: []),
		...(text
			? [
					{
						type: "text",
						text,
					},
				]
			: []),
		...calls.map(({ id, name, input }) => ({
			type: "tool_use",
			id,
			name,
			input,
		})),
	],
	stop_reason: calls.length > 0 ? "tool_use" : "end_turn",
	stop_sequence: null,
	usage: {
		input_tokens: 1,
		output_tokens: 1,
	},
});

const openAIReply = ({ reasoning, text, calls }: Reply) => ({
	id: "chatcmpl",
	object: "chat.completion",
	created: 0,
	model: "model",
	choices: [
		{
			index: 0,
			message: {
				role: "assistant",
				content: text ?? null,
				...(reasoning
					? {
							reasoning_content: reasoning,
						}
					: {}),
				...(calls.length > 0
					? {
							tool_calls: calls.map(({ id, name, input }) => ({
								id,
								type: "function",
								function: {
									name,
									arguments: JSON.stringify(input),
								},
							})),
						}
					: {}),
			},
			finish_reason: calls.length > 0 ? "tool_calls" : "stop",
		},
	],
	usage: {
		prompt_tokens: 1,
		completion_tokens: 1,
		total_tokens: 2,
	},
});

const anthropicEvents = ({ reasoning, text, calls }: Reply) => {
	const blocks = [
		...(reasoning
			? [
					{
						start: {
							type: "thinking",
							thinking: "",
						},
						deltas: [
							{
								type: "thinking_delta",
								thinking: reasoning,
							},
							{
								type: "signature_delta",
								signature: `signed:${reasoning}`,
							},
						],
					},
				]
			: []),
		...(text
			? [
					{
						start: {
							type: "text",
							text: "",
						},
						deltas: [
							{
								type: "text_delta",
								text,
							},
						],
					},
				]
			: []),
		...calls.map(({ id, name, input }) => ({
			start: {
				type: "tool_use",
				id,
				name,
				input: {},
			},
			deltas: [
				{
					type: "input_json_delta",
					partial_json: JSON.stringify(input),
				},
			],
		})),
	];
	return [
		{
			type: "message_start",
			message: {
				id: "msg",
				type: "message",
				role: "assistant",
				model: "claude",
				content: [],
				stop_reason: null,
				stop_sequence: null,
				usage: {
					input_tokens: 1,
					output_tokens: 0,
				},
			},
		},
		...blocks.flatMap(({ start, deltas }, index) => [
			{
				type: "content_block_start",
				index,
				content_block: start,
			},
			...deltas.map((delta) => ({
				type: "content_block_delta",
				index,
				delta,
			})),
			{
				type: "content_block_stop",
				index,
			},
		]),
		{
			type: "message_delta",
			delta: {
				stop_reason: calls.length > 0 ? "tool_use" : "end_turn",
				stop_sequence: null,
			},
			usage: {
				output_tokens: 1,
			},
		},
		{
			type: "message_stop",
		},
	].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
};

const openAIEvents = ({ reasoning, text, calls }: Reply) => {
	const chunk = (choices: unknown[], usage?: unknown) => ({
		id: "chatcmpl",
		object: "chat.completion.chunk",
		created: 0,
		model: "model",
		choices,
		...(usage
			? {
					usage,
				}
			: {}),
	});
	const delta = (fields: Record<string, unknown>) =>
		chunk([
			{
				index: 0,
				delta: fields,
				finish_reason: null,
			},
		]);
	return [
		delta({
			role: "assistant",
			content: "",
		}),
		...(reasoning
			? [
					delta({
						reasoning_content: reasoning,
					}),
				]
			: []),
		...(text
			? [
					delta({
						content: text,
					}),
				]
			: []),
		...calls.map(({ id, name, input }, index) =>
			delta({
				tool_calls: [
					{
						index,
						id,
						type: "function",
						function: {
							name,
							arguments: JSON.stringify(input),
						},
					},
				],
			}),
		),
		chunk([
			{
				index: 0,
				delta: {},
				finish_reason: calls.length > 0 ? "tool_calls" : "stop",
			},
		]),
		chunk([], {
			prompt_tokens: 1,
			completion_tokens: 1,
			total_tokens: 2,
		}),
	]
		.map((event) => `data: ${JSON.stringify(event)}\n\n`)
		.concat("data: [DONE]\n\n");
};

const eventStream = (events: string[]) => {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const event of events) controller.enqueue(encoder.encode(event));
			controller.close();
		},
	});
	return new Response(body, {
		headers: {
			"content-type": "text/event-stream",
		},
	});
};

/** A fetch that records each request body and answers with the next scripted step. */
export const scriptedFetch = (kind: ProviderKind) => {
	const bodies: Body[] = [];
	const steps: Step[] = [];
	const fetch = ((_input: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body));
		bodies.push(body);
		const step = steps.shift();
		if (step === undefined) {
			// A client error is not retried, so an unscripted request fails at once.
			return Promise.resolve(
				new Response("no step scripted", {
					status: 400,
				}),
			);
		}
		const reply = identify(step, kind === "anthropic" ? "toolu" : "call");
		if (body.stream === true) {
			return Promise.resolve(
				eventStream(
					kind === "anthropic" ? anthropicEvents(reply) : openAIEvents(reply),
				),
			);
		}
		return Promise.resolve(
			Response.json(
				kind === "anthropic" ? anthropicReply(reply) : openAIReply(reply),
			),
		);
	}) as typeof globalThis.fetch;

	return {
		fetch,
		bodies,
		script: (next: Step[]) => {
			steps.push(...next);
		},
	};
};

export const memberCapabilities: Record<OrganizationCapability, boolean> = {
	read: true,
	manage_organization: false,
	manage_members: false,
	manage_groups: false,
	invite_members: false,
	create_bot: true,
	create_block: true,
	create_asset: true,
	manage_providers: false,
	manage_models: false,
	manage_quotas: false,
};
