import { describe, expect, test } from "bun:test";
import type { ProviderKind } from "@orcai/core";
import { isStepCount, ToolLoopAgent, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod/v4";
import {
	FINAL_STEP_NOTE,
	finalStepSettings,
	stepBudgetOptionsSchema,
} from "./step-budget";

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

/** Calls the search tool until tools are ruled out or the note asks for an answer. */
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
 * An agent wired like the chat agents, its budget a call option. With
 * `activeTools`, it narrows the tools on every step as the assistant's plan
 * gating does.
 */
const runTurn = async (
	providerKind: ProviderKind,
	maxSteps = MAX_STEPS,
	activeTools?: "search"[],
) => {
	const { model, calls } = toolHungryModel();
	const agent = new ToolLoopAgent({
		model,
		tools: {
			search: tool({
				inputSchema: z.object({}),
				execute: async () => "a result",
			}),
			createBot: tool({
				inputSchema: z.object({}),
				execute: async () => "created",
			}),
		},
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => ({
			...settings,
			stopWhen: isStepCount(options.maxSteps),
			prepareStep: ({ stepNumber, messages }) => ({
				activeTools,
				...finalStepSettings({
					stepNumber,
					maxSteps: options.maxSteps,
					messages,
					providerKind,
				}),
			}),
		}),
	});
	const result = await agent.generate({
		prompt: "Check every citation.",
		options: {
			maxSteps,
		},
	});
	return {
		result,
		calls,
	};
};

describe("finalStepSettings", () => {
	test("leaves the steps before the last one alone", () => {
		expect(
			finalStepSettings({
				stepNumber: MAX_STEPS - 2,
				maxSteps: MAX_STEPS,
				messages: [],
				providerKind: "openai",
			}),
		).toBeUndefined();
	});

	test("a turn that keeps calling tools ends with an answer on the last step", async () => {
		const { result, calls } = await runTurn("openai");

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

	test("on Anthropic the last step gets the note and keeps its tools", async () => {
		const { result, calls } = await runTurn("anthropic");

		expect(result.text).toBe("Here is what I found so far.");
		const finalCall = calls.at(-1) as CallOptions;
		expect(finalCall.toolChoice?.type).toBe("auto");
		expect(finalCall.tools).toHaveLength(2);
		expect(lastPromptText(finalCall)).toBe(FINAL_STEP_NOTE);
	});

	test("the last step keeps the tool narrowing of the steps before it", async () => {
		const { result, calls } = await runTurn("anthropic", MAX_STEPS, [
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
			const { result, calls } = await runTurn("openai", maxSteps);

			expect(calls).toHaveLength(maxSteps);
			expect(result.text).toBe("Here is what I found so far.");
			expect(calls.at(-1)?.toolChoice).toEqual({
				type: "none",
			});
		}
	});
});
