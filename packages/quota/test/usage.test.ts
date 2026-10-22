import { describe, expect, test } from "bun:test";
import { recordedUsage } from "../src/usage";

describe("recordedUsage", () => {
	test("sums each token class over the steps, one request each", () => {
		expect(
			recordedUsage([
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
				{
					inputTokens: 100,
					noCacheInputTokens: 100,
					outputTokens: 10,
					totalTokens: 110,
					webSearches: 1,
				},
			]),
		).toEqual({
			requestCount: 2,
			inputTokens: 1_450,
			noCacheInputTokens: 150,
			cacheReadTokens: 1_000,
			cacheWriteTokens: 300,
			outputTokens: 410,
			reasoningTokens: 300,
			totalTokens: 1_860,
			webSearchCount: 3,
		});
	});

	test("leaves a class no step reported unknown", () => {
		expect(
			recordedUsage([
				{},
			]),
		).toEqual({
			requestCount: 1,
			inputTokens: undefined,
			noCacheInputTokens: undefined,
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
			outputTokens: undefined,
			reasoningTokens: undefined,
			totalTokens: undefined,
			webSearchCount: 0,
		});
	});
});
