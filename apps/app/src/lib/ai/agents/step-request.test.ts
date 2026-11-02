import { describe, expect, test } from "bun:test";
import {
	createAgentUIStream,
	type ModelMessage,
	ToolLoopAgent,
	tool,
	type UIMessageChunk,
} from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { z } from "zod/v4";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import { stepBudgetOptionsSchema } from "./step-budget";
import {
	createStepShaper,
	FINAL_STEP_NOTE,
	lastStepToolCalls,
} from "./step-request";

const MAX_STEPS = 3;

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

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

const lastPromptText = (options: CallOptions) => {
	const last = options.prompt.at(-1);
	return last?.role === "user" && last.content[0]?.type === "text"
		? last.content[0].text
		: undefined;
};

/** Calls the search tool, failing on the first call, until tools are ruled out or the note asks for an answer. */
const toolHungryModel = () => {
	const calls: CallOptions[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: (options) => {
			calls.push(options);
			const answers =
				options.toolChoice?.type === "none" ||
				lastPromptText(options) === FINAL_STEP_NOTE;
			return Promise.resolve({
				content: answers
					? [
							{
								type: "text",
								text: "Here is what I found so far.",
							},
						]
					: [
							{
								type: "tool-call",
								toolCallId: `call-${calls.length}`,
								toolName: "search",
								input: "{}",
							},
						],
				finishReason: {
					unified: answers ? "stop" : "tool-calls",
					raw: undefined,
				},
				usage,
				warnings: [],
			});
		},
	});
	return {
		model,
		calls,
	};
};

/**
 * An agent wired like the chat agents, its budget a call option; `pruned`
 * holds what the pruning policy saw on each step. With `activeTools`, it
 * narrows the tools on every step as the assistant's plan gating does.
 */
const runTurn = async (
	maxSteps = MAX_STEPS,
	activeTools?: "search"[],
	room?: {
		promptTokens: number;
		/** What each search after the failed first one returns. */
		result: string;
	},
) => {
	const { model, calls } = toolHungryModel();
	const pruned: ModelMessage[][] = [];
	const steps = createStepShaper({
		prune: (messages) => {
			pruned.push(messages);
			return messages;
		},
	});
	let searches = 0;
	const agent = new ToolLoopAgent({
		model,
		tools: {
			search: tool({
				inputSchema: z.object({}),
				execute: () => {
					searches += 1;
					return searches === 1
						? Promise.reject(
								new AssistantToolError("SEARCH_FAILED: Try again."),
							)
						: Promise.resolve(room?.result ?? "a result");
				},
			}),
			createBot: tool({
				inputSchema: z.object({}),
				execute: async () => "created",
			}),
		},
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => {
			const turn = steps.forTurn(options);
			return {
				...settings,
				stopWhen: turn.stopWhen,
				prepareStep: (step) => ({
					...turn.prepareStep(step),
					activeTools,
				}),
			};
		},
		onToolExecutionEnd: ({ toolOutput }) => steps.recordExecution(toolOutput),
	});
	const result = await agent.generate({
		prompt: "Check every citation.",
		options: {
			maxSteps,
			promptTokens: room?.promptTokens,
		},
	});
	return {
		result,
		calls,
		pruned,
		contextFull: steps.contextFull(),
	};
};

const errorTexts = (messages: ModelMessage[]) =>
	messages.flatMap((message) =>
		message.role === "tool"
			? message.content.flatMap((part) =>
					part.type === "tool-result" && part.output.type === "error-text"
						? [
								part.output.value,
							]
						: [],
				)
			: [],
	);

describe("createStepShaper", () => {
	test("prunes failures as the reply stores them, before the final-step note", async () => {
		const { pruned } = await runTurn();

		expect(pruned).toHaveLength(MAX_STEPS);
		expect(errorTexts(pruned.at(-1) ?? [])).toEqual([
			"SEARCH_FAILED: Try again.",
		]);
		for (const messages of pruned) {
			expect(messages.at(-1)?.content).not.toBe(FINAL_STEP_NOTE);
		}
	});

	test("a turn that keeps calling tools ends with an answer on the last step", async () => {
		const { result, calls } = await runTurn();

		expect(calls).toHaveLength(MAX_STEPS);
		expect(result.text).toBe("Here is what I found so far.");
		expect(result.finishReason).toBe("stop");
		for (const call of calls.slice(0, -1)) {
			expect(call.toolChoice?.type).not.toBe("none");
			expect(lastPromptText(call)).not.toBe(FINAL_STEP_NOTE);
		}
		const finalCall = calls.at(-1);
		expect(finalCall?.toolChoice).toEqual({
			type: "none",
		});
		expect(finalCall?.tools).toHaveLength(2);
		expect(lastPromptText(finalCall as CallOptions)).toBe(FINAL_STEP_NOTE);
	});

	test("the last step keeps the tool narrowing of the steps before it", async () => {
		const { result, calls } = await runTurn(MAX_STEPS, [
			"search",
		]);

		expect(result.text).toBe("Here is what I found so far.");
		for (const call of calls) {
			expect(call.tools?.map((tool) => tool.name)).toEqual([
				"search",
			]);
		}
		expect(lastPromptText(calls.at(-1) as CallOptions)).toBe(FINAL_STEP_NOTE);
	});

	test("a budget capped by the quota still ends with an answer on its last step", async () => {
		for (const maxSteps of [
			1,
			2,
		]) {
			const { result, calls } = await runTurn(maxSteps);

			expect(calls).toHaveLength(maxSteps);
			expect(result.text).toBe("Here is what I found so far.");
			expect(calls.at(-1)?.toolChoice).toEqual({
				type: "none",
			});
		}
	});

	describe("within the prompt room of a kind without native compaction", () => {
		/** About 500 tokens by the estimate. */
		const bigResult = "r".repeat(2_000);
		const toolResultIds = (call: CallOptions) =>
			call.prompt.flatMap((message) =>
				message.role === "tool"
					? message.content.flatMap((part) =>
							part.type === "tool-result"
								? [
										part.toolCallId,
									]
								: [],
						)
					: [],
			);

		test("a step that outgrows it leaves out the tool calls of the steps before the latest", async () => {
			const { result, calls, contextFull } = await runTurn(4, undefined, {
				promptTokens: 800,
				result: bigResult,
			});

			expect(calls.map(toolResultIds)).toEqual([
				[],
				[
					"call-1",
				],
				[
					"call-1",
					"call-2",
				],
				[
					"call-3",
				],
			]);
			expect(result.text).toBe("Here is what I found so far.");
			expect(contextFull).toBe(false);
		});

		test("the turn stops when even the latest step's calls do not fit", async () => {
			const { calls, contextFull } = await runTurn(4, undefined, {
				promptTokens: 300,
				result: bigResult,
			});

			expect(calls).toHaveLength(2);
			expect(contextFull).toBe(true);
		});
	});
});

describe("lastStepToolCalls", () => {
	/** Streams a turn whose model calls the search tool on every step, the last one included. */
	const streamStubbornTurn = async (transform: boolean) => {
		let searches = 0;
		const steps = createStepShaper({
			prune: (messages) => messages,
		});
		const agent = new ToolLoopAgent({
			model: new MockLanguageModelV4({
				doStream: () =>
					Promise.resolve({
						stream: convertArrayToReadableStream([
							{
								type: "tool-call",
								toolCallId: `call-${searches}`,
								toolName: "search",
								input: "{}",
							},
							{
								type: "finish",
								finishReason: {
									unified: "tool-calls",
									raw: undefined,
								},
								usage,
							},
						]),
					}),
			}),
			tools: {
				search: tool({
					inputSchema: z.object({}),
					execute: () => {
						searches += 1;
						return Promise.resolve("a result");
					},
				}),
			},
			callOptionsSchema: stepBudgetOptionsSchema,
			prepareCall: ({ options, ...settings }) => {
				const turn = steps.forTurn(options);
				return {
					...settings,
					stopWhen: turn.stopWhen,
					prepareStep: turn.prepareStep,
				};
			},
		});
		const chunks: UIMessageChunk[] = [];
		for await (const chunk of await createAgentUIStream({
			agent,
			uiMessages: [
				{
					id: "question",
					role: "user",
					parts: [
						{
							type: "text",
							text: "Check every citation.",
						},
					],
				},
			],
			options: {
				maxSteps: MAX_STEPS,
			},
			experimental_transform: transform
				? [
						lastStepToolCalls(),
					]
				: [],
			onError: () => "failed",
		})) {
			chunks.push(chunk);
		}
		return {
			chunks,
			searches,
		};
	};

	test("a last step that calls tools anyway ends in tool calls, running none of them", async () => {
		const { chunks, searches } = await streamStubbornTurn(true);

		expect(searches).toBe(MAX_STEPS - 1);
		expect(chunks.filter((chunk) => chunk.type === "error")).toEqual([]);
		expect(chunks.at(-1)).toMatchObject({
			type: "finish",
			finishReason: "tool-calls",
		});
	});

	test("without it the SDK reports those calls as an error", async () => {
		const { chunks, searches } = await streamStubbornTurn(false);

		expect(searches).toBe(MAX_STEPS - 1);
		expect(chunks.some((chunk) => chunk.type === "error")).toBe(true);
	});
});
