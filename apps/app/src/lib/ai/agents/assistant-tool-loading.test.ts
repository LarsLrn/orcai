import { describe, expect, test } from "bun:test";
import { createProviderLanguageModel, providerToolLoading } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import type { OrganizationCapability } from "@orcai/schema";
import { convertToModelMessages, type ModelMessage } from "ai";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import "../tools/assistant/test-procedures";
import type { DeferredToolGroup } from "../tools/assistant/groups";
import {
	ASSISTANT_TOOL_GROUPS,
	DEFERRED_TOOL_NAMES,
} from "../tools/assistant/groups";
import { createAssistantTurn } from "../tools/assistant/turn-state";

const { createAssistantAgent } = await import("./assistant-agent");

type ToolCall = {
	name: string;
	input: unknown;
};
/** One model response: tool calls, or the closing text. */
type Reply = ToolCall[] | string;

type Body = Record<string, unknown>;

let callCount = 0;

const anthropicReply = (reply: Reply) => ({
	id: "msg",
	type: "message",
	role: "assistant",
	model: "claude",
	content:
		typeof reply === "string"
			? [
					{
						type: "text",
						text: reply,
					},
				]
			: reply.map(({ name, input }) => ({
					type: "tool_use",
					id: `toolu_${++callCount}`,
					name,
					input,
				})),
	stop_reason: typeof reply === "string" ? "end_turn" : "tool_use",
	stop_sequence: null,
	usage: {
		input_tokens: 1,
		output_tokens: 1,
	},
});

const openAIReply = (reply: Reply) => ({
	id: "chatcmpl",
	object: "chat.completion",
	created: 0,
	model: "model",
	choices: [
		{
			index: 0,
			message:
				typeof reply === "string"
					? {
							role: "assistant",
							content: reply,
						}
					: {
							role: "assistant",
							content: null,
							tool_calls: reply.map(({ name, input }) => ({
								id: `call_${++callCount}`,
								type: "function",
								function: {
									name,
									arguments: JSON.stringify(input),
								},
							})),
						},
			finish_reason: typeof reply === "string" ? "stop" : "tool_calls",
		},
	],
	usage: {
		prompt_tokens: 1,
		completion_tokens: 1,
		total_tokens: 2,
	},
});

/** A fetch that records each request body and answers with the next scripted reply. */
const scriptedFetch = (kind: ProviderKind, replies: Reply[]) => {
	const bodies: Body[] = [];
	const fetch = ((_input: string | URL | Request, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		const reply = replies.shift();
		if (reply === undefined) {
			return Promise.resolve(
				new Response("no reply scripted", {
					status: 500,
				}),
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
	};
};

const memberCapabilities: Record<OrganizationCapability, boolean> = {
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

const assistantAgent = ({
	kind,
	modelId,
	capabilities = memberCapabilities,
	planApproved,
	loadedToolGroups,
	fetch,
}: {
	kind: ProviderKind;
	modelId: string;
	capabilities?: Record<OrganizationCapability, boolean>;
	planApproved: boolean;
	loadedToolGroups: DeferredToolGroup[];
	fetch?: typeof globalThis.fetch;
}) =>
	createAssistantAgent({
		model: createProviderLanguageModel(
			kind,
			{
				apiKey: "key",
				endpoint: kind === "openai-compatible" ? "https://llm.test/v1" : null,
				fetch,
			},
			modelId,
		),
		providerKind: kind,
		toolLoading: providerToolLoading(kind, modelId),
		callSettings: {},
		docs: undefined,
		userContext: {
			user: {
				id: "user",
				name: "Ada",
				email: "ada@example.org",
			},
			organizationName: "Org",
			role: "member",
			capabilities,
		},
		features: [],
		planApproved,
		loadedToolGroups,
		history: [],
		telemetryIds: {
			organizationId: "org",
			chatId: "chat",
			providerId: "provider",
			modelId,
		},
		context: {
			secureCookies: false,
		} as ORPCContext,
		turn: createAssistantTurn({
			zedToken: undefined,
			chatId: "chat",
			replyId: "reply",
		}),
	});

/**
 * Runs one request as the chat route does: a fresh agent over the
 * conversation, whose stored state says whether a plan is approved and which
 * groups are loaded.
 */
const runRequest = async ({
	kind,
	modelId,
	messages,
	planApproved,
	loadedToolGroups,
	replies,
}: {
	kind: ProviderKind;
	modelId: string;
	messages: ModelMessage[];
	planApproved: boolean;
	loadedToolGroups: DeferredToolGroup[];
	replies: Reply[];
}) => {
	const { fetch, bodies } = scriptedFetch(kind, replies);
	const agent = assistantAgent({
		kind,
		modelId,
		planApproved,
		loadedToolGroups,
		fetch,
	});

	const result = await agent.generate({
		messages,
		options: {
			maxSteps: 25,
		},
	});

	return {
		bodies,
		messages: [
			...messages,
			...result.responseMessages,
		],
	};
};

const userMessage = (text: string): ModelMessage => ({
	role: "user",
	content: text,
});

/** The user's approval of the pending `updatePlan` call. */
const approvePlan = (messages: ModelMessage[]): ModelMessage => {
	const request = messages
		.flatMap((message) =>
			message.role === "assistant" && Array.isArray(message.content)
				? message.content
				: [],
		)
		.find((part) => part.type === "tool-approval-request");

	return {
		role: "tool",
		content: [
			{
				type: "tool-approval-response",
				approvalId: request?.approvalId ?? "missing",
				approved: true,
			},
		],
	};
};

const plan = {
	title: "New bot",
	items: [
		{
			label: "Create the bot",
			status: "pending",
		},
	],
};

const botTools: readonly string[] = ASSISTANT_TOOL_GROUPS.bots;
const botCreateTools = [
	"createBot",
	"createTemplate",
	"createRepository",
];

/**
 * Loads, tries creating and proposes a plan; resumes once the user approved
 * it; then answers a new message. Five model requests.
 */
const conversation = async (kind: ProviderKind, modelId: string) => {
	const first = await runRequest({
		kind,
		modelId,
		messages: [
			userMessage("Make me a bot"),
		],
		planApproved: false,
		loadedToolGroups: [],
		replies: [
			[
				{
					name: "loadTools",
					input: {
						groups: [
							"bots",
							"people",
						],
					},
				},
			],
			[
				{
					name: "createBot",
					input: {
						name: "Helper",
						description: "Helps.",
					},
				},
			],
			[
				{
					name: "updatePlan",
					input: plan,
				},
			],
		],
	});
	const approved = await runRequest({
		kind,
		modelId,
		messages: [
			...first.messages,
			approvePlan(first.messages),
		],
		planApproved: false,
		loadedToolGroups: [
			"bots",
		],
		replies: [
			"Approved, starting.",
		],
	});
	const next = await runRequest({
		kind,
		modelId,
		messages: [
			...approved.messages,
			userMessage("Thanks"),
		],
		planApproved: true,
		loadedToolGroups: [
			"bots",
		],
		replies: [
			"You're welcome.",
		],
	});

	return [
		...first.bodies,
		...approved.bodies,
		...next.bodies,
	];
};

type AnthropicTool = {
	name: string;
	defer_loading?: boolean;
};
type AnthropicBlock = {
	type: string;
	tool_use_id?: string;
	tool_name?: string;
	content?: string | AnthropicBlock[];
};

const anthropicTools = (body: Body) => body.tools as AnthropicTool[];

const anthropicResults = (body: Body) =>
	(
		body.messages as {
			content: string | AnthropicBlock[];
		}[]
	)
		.flatMap((message) =>
			Array.isArray(message.content) ? message.content : [],
		)
		.filter((block) => block.type === "tool_result");

const referencesIn = (results: AnthropicBlock[]) =>
	results.flatMap((result) =>
		Array.isArray(result.content)
			? result.content
					.filter((block) => block.type === "tool_reference")
					.map((block) => block.tool_name)
			: [],
	);

const openAITools = (body: Body) =>
	(
		body.tools as {
			function: {
				name: string;
			};
		}[]
	).map((tool) => tool.function.name);

const [anthropicBodies, fallbackBodies, openAIBodies] = await Promise.all([
	conversation("anthropic", "claude-opus-5-5"),
	conversation("anthropic", "claude-opus-4-1-20250805"),
	conversation("openai-compatible", "model"),
]);

describe("assistant tool loading on Anthropic", () => {
	const bodies = anthropicBodies;

	test("every request declares the same tools", () => {
		expect(bodies).toHaveLength(5);
		for (const body of bodies) {
			expect(anthropicTools(body)).toEqual(anthropicTools(bodies[0] ?? {}));
		}
	});

	test("declares the role's tools, deferring every group tool", () => {
		const tools = anthropicTools(bodies[0] ?? {});

		expect(tools.map((tool) => tool.name)).toContain("createBot");
		expect(tools.map((tool) => tool.name)).not.toContain("listMembers");
		expect(tools.map((tool) => tool.name)).not.toContain("createGroup");
		for (const tool of tools) {
			expect(tool.defer_loading ?? false).toBe(
				DEFERRED_TOOL_NAMES.has(tool.name),
			);
		}
	});

	test("loadTools references the loaded tools, holding create tools back until the plan is approved", () => {
		const [loadResult] = anthropicResults(bodies[1] ?? {});

		expect(
			referencesIn([
				loadResult ?? {
					type: "missing",
				},
			]),
		).toEqual(botTools.filter((name) => !botCreateTools.includes(name)));
		expect(
			Array.isArray(loadResult?.content) && loadResult.content[0]?.type,
		).toBe("text");
	});

	test("a create tool refuses before the plan is approved", () => {
		const results = anthropicResults(bodies[2] ?? {});

		expect(JSON.stringify(results.at(-1))).toContain("PLAN_NOT_APPROVED");
	});

	test("the approved plan references the create tools", () => {
		const results = anthropicResults(bodies[3] ?? {});

		expect(referencesIn(results.slice(-1))).toEqual(botCreateTools);
	});

	test("references persist into the next turn", () => {
		expect(referencesIn(anthropicResults(bodies[4] ?? {})).sort()).toEqual(
			[
				...botTools,
			].sort(),
		);
	});

	test("caches the stable system prompt", () => {
		const [stable] = (bodies[0]?.system ?? []) as {
			cache_control?: unknown;
		}[];

		expect(stable?.cache_control).toEqual({
			type: "ephemeral",
		});
	});
});

describe("assistant tool loading on a Claude model without tool search", () => {
	const bodies = fallbackBodies;

	test("offers loaded tools through the tool list, without references", () => {
		const names = bodies.map((body) =>
			anthropicTools(body).map((tool) => tool.name),
		);

		expect(names[0]).not.toContain("updateBot");
		expect(names[1]).toContain("updateBot");
		expect(names[1]).not.toContain("createBot");
		expect(names[4]).toContain("createBot");
		for (const body of bodies) {
			expect(
				anthropicTools(body).some((tool) => tool.defer_loading !== undefined),
			).toBe(false);
			expect(referencesIn(anthropicResults(body))).toEqual([]);
		}
	});
});

describe("assistant tool loading on an OpenAI-compatible endpoint", () => {
	const bodies = openAIBodies;

	test("offers loaded tools through the tool list", () => {
		const names = bodies.map(openAITools);

		expect(names[0]).toContain("loadTools");
		expect(names[0]).not.toContain("updateBot");
		expect(names[1]).toContain("updateBot");
		expect(names[1]).not.toContain("createBot");
		expect(names[3]).toContain("createBot");
		expect(names[4]).toEqual(names[3] ?? []);
	});
});

describe("a stored loadTools result replayed on Anthropic", () => {
	const peopleTools: readonly string[] = ASSISTANT_TOOL_GROUPS.people;
	const invitationTools = [
		"inviteMembers",
		"listInvitations",
		"cancelInvitation",
	];
	const inviter = {
		...memberCapabilities,
		invite_members: true,
	};
	const admin = {
		...inviter,
		manage_members: true,
		manage_groups: true,
	};

	/** The references the stored history sends, converted as the chat route converts it. */
	const replayedReferences = async (
		capabilities: Record<OrganizationCapability, boolean>,
		storedTools: readonly string[],
	) => {
		const agent = assistantAgent({
			kind: "anthropic",
			modelId: "claude-opus-5-5",
			capabilities,
			planApproved: true,
			loadedToolGroups: [
				"people",
			],
		});
		const messages = await convertToModelMessages(
			[
				{
					role: "assistant",
					parts: [
						{
							type: "tool-loadTools",
							toolCallId: "call-load",
							state: "output-available",
							input: {
								groups: [
									"people",
								],
							},
							output: {
								groups: [
									{
										group: "people",
										loaded: true,
										tools: storedTools,
									},
								],
							},
						},
					],
				},
			],
			{
				tools: agent.tools,
			},
		);

		return messages.flatMap((message) =>
			message.role === "tool"
				? message.content.flatMap((part) =>
						part.type === "tool-result" && part.output.type === "content"
							? part.output.value.flatMap((content) =>
									content.type === "custom"
										? [
												content.providerOptions?.anthropic?.toolName,
											]
										: [],
								)
							: [],
					)
				: [],
		);
	};

	test("references only the tools the role may use now", async () => {
		expect(await replayedReferences(inviter, peopleTools)).toEqual(
			invitationTools,
		);
	});

	test("references tools granted since the group loaded", async () => {
		expect((await replayedReferences(admin, invitationTools)).sort()).toEqual(
			peopleTools.filter((name) => name !== "createGroup").sort(),
		);
	});
});
