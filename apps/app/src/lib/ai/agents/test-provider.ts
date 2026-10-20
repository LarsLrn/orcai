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

let callCount = 0;

const anthropicReply = ({ reasoning, text, calls = [] }: Step) => ({
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
		...calls.map(({ name, input }) => ({
			type: "tool_use",
			id: `toolu_${++callCount}`,
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

const openAIReply = ({ reasoning, text, calls = [] }: Step) => ({
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
							tool_calls: calls.map(({ name, input }) => ({
								id: `call_${++callCount}`,
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

/** A fetch that records each request body and answers with the next scripted step. */
export const scriptedFetch = (kind: ProviderKind) => {
	const bodies: Body[] = [];
	const steps: Step[] = [];
	const fetch = ((_input: string | URL | Request, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		const step = steps.shift();
		if (step === undefined) {
			return Promise.resolve(
				new Response("no step scripted", {
					status: 500,
				}),
			);
		}
		return Promise.resolve(
			Response.json(
				kind === "anthropic" ? anthropicReply(step) : openAIReply(step),
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
