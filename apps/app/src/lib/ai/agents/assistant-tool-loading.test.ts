import { describe, expect, test } from "bun:test";
import type { ProviderKind } from "@orcai/core";
import type { OrganizationCapability } from "@orcai/schema";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { resetProcedures } from "../tools/assistant/test-procedures";
import { answerSetup, assistantRow, conversation } from "../turn/test-turn";
import type { Body } from "./test-provider";

const { convertToModelMessages } = await import("ai");
const { ASSISTANT_TOOL_GROUPS, DEFERRED_TOOL_NAMES } = await import(
	"../tools/assistant/groups"
);
const { createAssistantTurn } = await import("../tools/assistant/turn-state");
const { agentModel } = await import("./agent-model");
const { memberCapabilities } = await import("./test-provider");
const { createAssistantAgent } = await import("./assistant-agent");

const assistantConversation = (kind: ProviderKind, modelId: string) => {
	resetProcedures();
	answerSetup({
		providerKind: kind,
		providerModelId: modelId,
	});
	return conversation(assistantRow(), kind);
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

const createBot = {
	name: "createBot",
	input: {
		name: "Helper",
		description: "Helps.",
	},
};

const loadTools = (...groups: string[]) => ({
	name: "loadTools",
	input: {
		groups,
	},
});

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
const toolLoadingConversation = async (kind: ProviderKind, modelId: string) => {
	const assistant = await assistantConversation(kind, modelId);
	assistant.script([
		{
			calls: [
				loadTools("bots", "people"),
			],
		},
		{
			calls: [
				createBot,
			],
		},
		{
			calls: [
				{
					name: "updatePlan",
					input: plan,
				},
			],
		},
	]);
	await assistant.send("Make me a bot");
	assistant.script([
		{
			text: "Approved, starting.",
		},
	]);
	await assistant.decide(true);
	assistant.script([
		{
			text: "You're welcome.",
		},
	]);
	await assistant.send("Thanks");

	return assistant.bodies;
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

const anthropicBodies = await toolLoadingConversation(
	"anthropic",
	"claude-opus-5-5",
);
const fallbackBodies = await toolLoadingConversation(
	"anthropic",
	"claude-opus-4-1-20250805",
);
const openAIBodies = await toolLoadingConversation(
	"openai-compatible",
	"model",
);

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
		const { agent } = createAssistantAgent({
			model: agentModel({
				kind: "anthropic",
				connection: {
					apiKey: "key",
					endpoint: null,
				},
				providerModelId: "claude-opus-5-5",
			}),
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
			history: [],
			plan: undefined,
			telemetryIds: {
				organizationId: "org",
				chatId: "chat",
				providerId: "provider",
				modelId: "claude-opus-5-5",
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

describe.each([
	[
		"anthropic",
		"claude-opus-5-5",
	],
	[
		"openai-compatible",
		"model",
	],
] as const)("a declined plan on %s", (kind, modelId) => {
	test("keeps the create tools locked", async () => {
		const assistant = await assistantConversation(kind, modelId);
		assistant.script([
			{
				calls: [
					loadTools("bots"),
				],
			},
			{
				calls: [
					{
						name: "updatePlan",
						input: plan,
					},
				],
			},
		]);
		await assistant.send("Make me a bot");
		assistant.script([
			{
				calls: [
					createBot,
				],
			},
			{
				text: "I will revise the plan.",
			},
		]);
		await assistant.decide(false);
		const bodies = assistant.bodies.slice(2);

		expect(bodies).toHaveLength(2);
		if (kind === "anthropic") {
			expect(
				JSON.stringify(anthropicResults(bodies[1] ?? {}).at(-1)),
			).toContain("PLAN_NOT_APPROVED");
			expect(referencesIn(anthropicResults(bodies[1] ?? {}))).not.toContain(
				"createBot",
			);
		} else {
			for (const body of bodies) {
				expect(openAITools(body)).not.toContain("createBot");
			}
		}
	});
});
