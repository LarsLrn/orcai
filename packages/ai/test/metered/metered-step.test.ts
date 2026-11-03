import { describe, expect, test } from "bun:test";
import type { MeteredStep } from "@orcai/quota";
import { type MeterStep, meteredStep } from "../../src/metered/metered-step";

const usage = (
	inputTokens: number | undefined,
	outputTokens: number | undefined,
): MeterStep => ({
	usage: {
		inputTokens,
		inputTokenDetails: {
			noCacheTokens: inputTokens,
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
		},
		outputTokens,
		outputTokenDetails: {
			textTokens: outputTokens,
			reasoningTokens: undefined,
		},
		totalTokens:
			inputTokens === undefined || outputTokens === undefined
				? undefined
				: inputTokens + outputTokens,
	},
	toolCalls: [],
});

describe("meteredStep", () => {
	test("keeps each token class, unknown when the provider left it out", () => {
		const steps: MeteredStep[] = [];

		steps.push(meteredStep(usage(100, 20)));
		steps.push(meteredStep(usage(undefined, 5)));

		expect(steps).toEqual([
			{
				inputTokens: 100,
				noCacheInputTokens: 100,
				cacheReadTokens: undefined,
				cacheWriteTokens: undefined,
				outputTokens: 20,
				reasoningTokens: undefined,
				totalTokens: 120,
				webSearches: 0,
			},
			{
				inputTokens: undefined,
				noCacheInputTokens: undefined,
				cacheReadTokens: undefined,
				cacheWriteTokens: undefined,
				outputTokens: 5,
				reasoningTokens: undefined,
				totalTokens: undefined,
				webSearches: 0,
			},
		]);
	});

	test("keeps an Anthropic step's cache classes and counted searches", () => {
		const steps: MeteredStep[] = [];

		steps.push(
			meteredStep({
				usage: {
					inputTokens: 1_350,
					inputTokenDetails: {
						noCacheTokens: 50,
						cacheReadTokens: 1_000,
						cacheWriteTokens: 300,
					},
					outputTokens: 400,
					outputTokenDetails: {
						textTokens: 100,
						reasoningTokens: 300,
					},
					totalTokens: 1_750,
					raw: {
						input_tokens: 50,
						cache_read_input_tokens: 1_000,
						cache_creation_input_tokens: 300,
						output_tokens: 400,
						server_tool_use: {
							web_search_requests: 2,
						},
					},
				},
				toolCalls: [],
			}),
		);

		expect(steps).toEqual([
			{
				inputTokens: 1_350,
				noCacheInputTokens: 50,
				cacheReadTokens: 1_000,
				cacheWriteTokens: 300,
				outputTokens: 400,
				reasoningTokens: 300,
				totalTokens: 1_750,
				webSearches: 2,
			},
		]);
	});

	test("counts an OpenAI step's provider-executed web searches", () => {
		const steps: MeteredStep[] = [];
		const call = (toolName: string, providerExecuted: boolean) => ({
			type: "tool-call" as const,
			toolCallId: crypto.randomUUID(),
			toolName,
			input: {},
			providerExecuted,
			dynamic: true as const,
		});

		steps.push(
			meteredStep({
				...usage(10, 10),
				toolCalls: [
					call("web_search", true),
					call("web_search", true),
					call("web_search", false),
					call("code_execution", true),
				],
			}),
		);

		expect(steps).toMatchObject([
			{
				webSearches: 2,
			},
		]);
	});

	test("keeps the cost its provider reported", () => {
		const steps: MeteredStep[] = [];
		const reporting = (cost: number | string): MeterStep => {
			const step = usage(10, 10);
			return {
				...step,
				usage: {
					...step.usage,
					raw: {
						prompt_tokens: 10,
						completion_tokens: 10,
						cost,
					},
				},
			};
		};

		steps.push(meteredStep(reporting(0.0012)));
		steps.push(meteredStep(usage(10, 10)));
		steps.push(meteredStep(reporting("0.5")));
		steps.push(meteredStep(reporting(0.0005)));

		expect(steps.map(({ reportedCost }) => reportedCost)).toEqual([
			0.0012,
			undefined,
			undefined,
			0.0005,
		]);
	});
});
