import { describe, expect, test } from "bun:test";
import {
	createAgentUIStream,
	isStepCount,
	ToolLoopAgent,
	tool,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { deleteBotInputSchema } from "@/lib/ai/tools/assistant/bots/delete-bot.declaration";
import { findBotsTool } from "@/lib/ai/tools/assistant/core/find-bots";
import { planSchema } from "@/lib/ai/tools/assistant/plan/plan";
import type { AssistantToolDeps } from "@/lib/ai/tools/assistant/procedure-tool";
import { findPeopleTool } from "@/lib/ai/tools/assistant/sharing/find-people";
import {
	type ChatAgentUIMessage,
	toChatAgentParts,
} from "./chat-agent-message";

type LanguageModelV4StreamPart =
	Awaited<
		ReturnType<MockLanguageModelV4["doStream"]>
	>["stream"] extends globalThis.ReadableStream<infer Part>
		? Part
		: never;

const usage = {
	inputTokens: {
		total: 1,
		noCache: 1,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: {
		total: 1,
		text: 1,
		reasoning: undefined,
	},
};

const finish = (unified: "stop" | "tool-calls"): LanguageModelV4StreamPart => ({
	type: "finish",
	finishReason: {
		unified,
		raw: unified,
	},
	usage,
});

const textStep = (text: string): LanguageModelV4StreamPart[] => [
	{
		type: "text-start",
		id: "t",
	},
	{
		type: "text-delta",
		id: "t",
		delta: text,
	},
	{
		type: "text-end",
		id: "t",
	},
	finish("stop"),
];

const callStep = (
	toolName: string,
	input: unknown,
): LanguageModelV4StreamPart[] => [
	{
		type: "tool-call",
		toolCallId: `call-${toolName}`,
		toolName,
		input: JSON.stringify(input),
	},
	finish("tool-calls"),
];

const scriptedModel = (...steps: LanguageModelV4StreamPart[][]) =>
	new MockLanguageModelV4({
		doStream: steps.map((chunks) => ({
			stream: convertArrayToReadableStream(chunks),
		})),
	});

const plan = (label: string) => ({
	title: "Course bot",
	items: [
		{
			label,
			status: "pending",
		},
	],
});
const tooLong = plan("x".repeat(260));

const agentWith = (model: MockLanguageModelV4) =>
	new ToolLoopAgent({
		model,
		tools: {
			updatePlan: tool({
				inputSchema: planSchema,
				execute: () => ({
					updated: true as const,
				}),
			}),
			deleteBot: tool({
				inputSchema: deleteBotInputSchema,
				execute: (): {
					deleted: true;
				} => {
					throw new Error("BOT_NOT_FOUND: The bot is gone.");
				},
			}),
		},
		toolApproval: {
			updatePlan: "user-approval",
			deleteBot: "user-approval",
		},
		stopWhen: isStepCount(5),
	});

const run = async (model: MockLanguageModelV4, messages: UIMessage[]) => {
	const chunks: UIMessageChunk[] = [];
	for await (const chunk of await createAgentUIStream({
		agent: agentWith(model),
		uiMessages: messages,
	})) {
		chunks.push(chunk);
	}
	return chunks;
};

/** The tool results the model was sent in its `index`th request. */
const toolResultsSent = (model: MockLanguageModelV4, index: number) =>
	JSON.stringify(
		model.doStreamCalls[index]?.prompt.filter(
			(message) => message.role === "tool",
		),
	);

const user: UIMessage = {
	id: "user",
	role: "user",
	parts: [
		{
			type: "text",
			text: "Set up a course bot",
		},
	],
};

const pausedReply = (
	toolName: string,
	input: unknown,
	state: "approval-requested" | "approval-responded",
): UIMessage => ({
	id: "reply",
	role: "assistant",
	parts: [
		{
			type: "step-start",
		},
		{
			type: `tool-${toolName}`,
			toolCallId: `call-${toolName}`,
			state,
			input,
			approval:
				state === "approval-responded"
					? {
							id: "approval-1",
							approved: true,
						}
					: {
							id: "approval-1",
						},
		} as UIMessage["parts"][number],
	],
});

/** The message as a turn reads it from storage. */
const read = (message: UIMessage): UIMessage => ({
	...message,
	parts: toChatAgentParts(
		message.parts as ChatAgentUIMessage["parts"],
	) as UIMessage["parts"],
});

const botId = "00000000-0000-4000-8000-000000000001";

describe("invalid tool input", () => {
	test("is refused before approval, so the model retries in the same turn", async () => {
		const model = scriptedModel(
			callStep("updatePlan", tooLong),
			textStep("Let me shorten that."),
		);

		const chunks = await run(model, [
			user,
		]);

		expect(chunks.map((chunk) => chunk.type)).not.toContain(
			"tool-approval-request",
		);
		expect(chunks.map((chunk) => chunk.type)).toContain("tool-input-error");
		expect(model.doStreamCalls).toHaveLength(2);
		expect(toolResultsSent(model, 1)).toContain(
			"Invalid input for tool updatePlan",
		);
	});

	test("an approved call with invalid stored input fails the turn unless read", async () => {
		const reply = pausedReply("updatePlan", tooLong, "approval-responded");

		await expect(
			run(scriptedModel(textStep("unused")), [
				user,
				reply,
			]),
		).rejects.toThrow();

		const model = scriptedModel(textStep("Let me shorten that."));
		const chunks = await run(model, [
			user,
			read(reply),
		]);

		expect(chunks.map((chunk) => chunk.type)).toContain("finish");
		expect(chunks.map((chunk) => chunk.type)).not.toContain("error");
		expect(toolResultsSent(model, 0)).toContain("INVALID_TOOL_INPUT");
	});

	test("an approved call that fails to run reports its error and the turn goes on", async () => {
		const model = scriptedModel(textStep("The bot was already gone."));

		const chunks = await run(model, [
			user,
			read(
				pausedReply(
					"deleteBot",
					{
						ids: [
							botId,
						],
					},
					"approval-responded",
				),
			),
		]);

		expect(chunks.map((chunk) => chunk.type)).toContain("tool-output-error");
		expect(chunks.map((chunk) => chunk.type)).not.toContain("error");
		expect(toolResultsSent(model, 0)).toContain("BOT_NOT_FOUND");
	});
});

const call = (
	toolName: string,
	fields: Record<string, unknown>,
): ChatAgentUIMessage["parts"][number] =>
	({
		type: `tool-${toolName}`,
		toolCallId: `call-${toolName}`,
		...fields,
	}) as ChatAgentUIMessage["parts"][number];

describe("toChatAgentParts", () => {
	test("closes an open call with invalid input as INVALID_TOOL_INPUT", () => {
		const [part] = toChatAgentParts([
			call("updatePlan", {
				state: "approval-requested",
				input: tooLong,
				approval: {
					id: "approval-1",
				},
			}),
		]);

		expect(part).toMatchObject({
			type: "tool-updatePlan",
			state: "output-error",
			input: tooLong,
			errorText: expect.stringMatching(
				/^INVALID_TOOL_INPUT: Invalid input for tool updatePlan: /,
			),
		});
		expect(part).not.toHaveProperty("approval");
	});

	test("keeps a settled call with invalid input as an untyped call", () => {
		const parts = toChatAgentParts([
			call("updatePlan", {
				state: "output-available",
				input: tooLong,
				output: {
					updated: true,
				},
			}),
			call("deleteBot", {
				state: "output-denied",
				input: null,
				approval: {
					id: "approval-1",
					approved: false,
				},
			}),
		]);

		expect(parts).toMatchObject([
			{
				type: "dynamic-tool",
				toolName: "updatePlan",
				state: "output-available",
				input: tooLong,
				output: {
					updated: true,
				},
			},
			{
				type: "dynamic-tool",
				toolName: "deleteBot",
				state: "output-denied",
			},
		]);
	});

	test("keeps a client answer that does not fit as an untyped call", () => {
		const [part] = toChatAgentParts([
			call("requestUpload", {
				state: "output-available",
				input: {
					reason: "Upload the style guides.",
				},
				output: {
					status: "lost",
				},
			}),
		]);

		expect(part).toMatchObject({
			type: "dynamic-tool",
			toolName: "requestUpload",
			output: {
				status: "lost",
			},
		});
	});

	test("leaves failed, streaming, undeclared and fitting calls as they are", () => {
		const parts = [
			call("deleteBot", {
				state: "output-error",
				input: {
					ids: [],
				},
				errorText: "Invalid input for tool deleteBot",
			}),
			call("deleteBot", {
				state: "input-streaming",
				input: {
					ids: "partial",
				},
			}),
			call("retiredTool", {
				state: "output-available",
				input: 17,
				output: null,
			}),
			{
				type: "dynamic-tool",
				toolName: "mcp",
				toolCallId: "call-mcp",
				state: "output-available",
				input: 17,
				output: null,
			},
			call("requestUpload", {
				state: "output-available",
				input: {
					reason: "Upload the style guides.",
				},
				output: {
					status: "cancelled",
				},
			}),
			call("updatePlan", {
				state: "approval-requested",
				input: plan("Create the bot"),
				approval: {
					id: "approval-2",
				},
			}),
		] as ChatAgentUIMessage["parts"];

		expect(toChatAgentParts(parts)).toBe(parts);
	});
});

const pagingTools = {
	findBots: findBotsTool({} as AssistantToolDeps),
	findPeople: findPeopleTool({} as AssistantToolDeps),
};

/** What the model is sent for a stored reply, read as a turn reads it. */
const requestFor = async (parts: unknown[]) => {
	const model = scriptedModel(textStep("Done."));
	for await (const _ of await createAgentUIStream({
		agent: new ToolLoopAgent({
			model,
			tools: pagingTools,
		}),
		uiMessages: [
			user,
			read({
				id: "reply",
				role: "assistant",
				parts: parts as UIMessage["parts"],
			}),
			{
				...user,
				id: "question",
			},
		],
	})) {
		// The request is all this reads.
	}
	return model.doStreamCalls[0]?.prompt;
};

describe("a stored call of an earlier input shape", () => {
	const earlier = [
		{
			type: "tool-findBots",
			toolCallId: "call-bots",
			state: "output-available",
			input: {
				query: "Quiz",
				limit: 30,
			},
			output: {
				bots: [],
				total: 0,
			},
		},
		{
			type: "tool-findPeople",
			toolCallId: "call-people",
			state: "output-available",
			input: {
				targetType: "bot",
				targetId: botId,
				limit: 20,
			},
			output: {
				grantees: [],
				count: 3,
			},
		},
	];

	test("reads as an untyped call", () => {
		expect(
			toChatAgentParts(earlier as ChatAgentUIMessage["parts"]).map(
				(part) => part.type,
			),
		).toEqual([
			"dynamic-tool",
			"dynamic-tool",
		]);
	});

	test("sends the model its input and its output as stored", async () => {
		const prompt = await requestFor(earlier);

		expect(prompt?.filter((message) => message.role !== "system")).toEqual([
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Set up a course bot",
					},
				],
				providerOptions: undefined,
			},
			{
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "call-bots",
						toolName: "findBots",
						input: {
							query: "Quiz",
							limit: 30,
						},
						providerExecuted: undefined,
						providerOptions: undefined,
					},
					{
						type: "tool-call",
						toolCallId: "call-people",
						toolName: "findPeople",
						input: {
							targetType: "bot",
							targetId: botId,
							limit: 20,
						},
						providerExecuted: undefined,
						providerOptions: undefined,
					},
				],
				providerOptions: undefined,
			},
			{
				role: "tool",
				content: [
					{
						type: "tool-result",
						toolCallId: "call-bots",
						toolName: "findBots",
						output: {
							type: "json",
							value: {
								bots: [],
								total: 0,
							},
						},
						providerOptions: undefined,
					},
					{
						type: "tool-result",
						toolCallId: "call-people",
						toolName: "findPeople",
						output: {
							type: "json",
							value: {
								grantees: [],
								count: 3,
							},
						},
						providerOptions: undefined,
					},
				],
				providerOptions: undefined,
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Set up a course bot",
					},
				],
				providerOptions: undefined,
			},
		]);
	});
});
