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
import { z } from "zod/v4";
import { planSchema } from "@/lib/ai/tools/assistant/plan/plan";
import { closeInvalidToolParts } from "./close-invalid-tool-parts";

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
				inputSchema: z.object({
					title: z.string(),
				}),
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

	test("an approved call with invalid stored input fails the turn unless closed", async () => {
		const reply = pausedReply("updatePlan", tooLong, "approval-responded");

		await expect(
			run(scriptedModel(textStep("unused")), [
				user,
				reply,
			]),
		).rejects.toThrow();

		const model = scriptedModel(textStep("Let me shorten that."));
		const chunks = await run(
			model,
			await closeInvalidToolParts(
				[
					user,
					reply,
				],
				agentWith(model).tools,
			),
		);

		expect(chunks.map((chunk) => chunk.type)).toContain("finish");
		expect(chunks.map((chunk) => chunk.type)).not.toContain("error");
		expect(toolResultsSent(model, 0)).toContain("INVALID_TOOL_INPUT");
	});

	test("an approved call that fails to run reports its error and the turn goes on", async () => {
		const model = scriptedModel(textStep("The bot was already gone."));

		const chunks = await run(model, [
			user,
			pausedReply(
				"deleteBot",
				{
					title: "Course bot",
				},
				"approval-responded",
			),
		]);

		expect(chunks.map((chunk) => chunk.type)).toContain("tool-output-error");
		expect(chunks.map((chunk) => chunk.type)).not.toContain("error");
		expect(toolResultsSent(model, 0)).toContain("BOT_NOT_FOUND");
	});
});

describe("closeInvalidToolParts", () => {
	const tools = agentWith(scriptedModel()).tools;

	test("closes an open call with invalid input as INVALID_TOOL_INPUT", async () => {
		const [, closed] = await closeInvalidToolParts(
			[
				user,
				pausedReply("updatePlan", tooLong, "approval-requested"),
			],
			tools,
		);

		const part = closed?.parts[1];

		expect(part).toMatchObject({
			type: "tool-updatePlan",
			state: "output-error",
			input: tooLong,
			errorText: expect.stringMatching(
				/^INVALID_TOOL_INPUT: Invalid input for tool updatePlan/,
			),
		});
		expect(part).not.toHaveProperty("approval");
	});

	test("keeps a settled call with invalid input as an untyped call", async () => {
		const [closed] = await closeInvalidToolParts(
			[
				{
					id: "reply",
					role: "assistant",
					parts: [
						{
							type: "tool-updatePlan",
							toolCallId: "call-1",
							state: "output-available",
							input: tooLong,
							output: {
								updated: true,
							},
						},
					],
				},
			],
			tools,
		);

		expect(closed?.parts[0]).toMatchObject({
			type: "dynamic-tool",
			toolName: "updatePlan",
			state: "output-available",
		});
	});

	test("leaves valid calls and other messages as they are", async () => {
		const messages = [
			user,
			pausedReply("updatePlan", plan("Create the bot"), "approval-requested"),
		];

		const closed = await closeInvalidToolParts(messages, tools);

		expect(closed[0]).toBe(messages[0]);
		expect(closed[1]).toBe(messages[1]);
	});
});
