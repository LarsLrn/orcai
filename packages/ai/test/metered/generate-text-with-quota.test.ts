import { beforeEach, expect, test } from "bun:test";
import type { ModelId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import { quota, withQuotaServices } from "@orcai/quota/testing";
import { Output } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { aiFailure, failedReply } from "../../src/ai-failure";
import { AiError } from "../../src/errors";
import { generateTextWithQuota } from "../../src/metered/generate-text-with-quota";

const generate = (model: MockLanguageModelV4) =>
	withQuotaServices(
		generateTextWithQuota({
			operation: "test.generate",
			appRequestId: "request-1",
			organizationId: "org-1" as OrganizationId,
			userId: "user-1" as UserId,
			providerId: "provider-1" as ProviderId,
			modelId: "model-1" as ModelId,
			model,
			prompt: "Name this chat.",
		}),
	);

const generateTitle = (model: MockLanguageModelV4) =>
	withQuotaServices(
		generateTextWithQuota({
			operation: "test.generate",
			appRequestId: "request-1",
			organizationId: "org-1" as OrganizationId,
			userId: "user-1" as UserId,
			providerId: "provider-1" as ProviderId,
			modelId: "model-1" as ModelId,
			model,
			prompt: "Describe this.",
			output: Output.object({
				schema: z.object({
					title: z.string(),
				}),
			}),
		}),
	);

const reply = (params: {
	text: string;
	finishReason: "stop" | "length";
	outputTokens: number;
	reasoningTokens?: number;
}) =>
	new MockLanguageModelV4({
		doGenerate: {
			content: [
				...(params.reasoningTokens
					? [
							{
								type: "reasoning" as const,
								text: "Thinking about the title.",
							},
						]
					: []),
				{
					type: "text",
					text: params.text,
				},
			],
			finishReason: {
				unified: params.finishReason,
				raw: undefined,
			},
			usage: {
				inputTokens: {
					total: 20,
					noCache: 20,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: params.outputTokens,
					text: params.outputTokens - (params.reasoningTokens ?? 0),
					reasoning: params.reasoningTokens,
				},
			},
			warnings: [],
		},
	});

const aiError = (error: unknown) => {
	expect(error).toBeInstanceOf(AiError);
	return error as AiError;
};

beforeEach(() => {
	quota.reset();
});

test("a generation is charged the usage the model reported", async () => {
	const model = new MockLanguageModelV4({
		doGenerate: {
			content: [
				{
					type: "text",
					text: "A title",
				},
			],
			finishReason: {
				unified: "stop",
				raw: undefined,
			},
			usage: {
				inputTokens: {
					total: 12,
					noCache: 12,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: 3,
					text: 3,
					reasoning: undefined,
				},
			},
			warnings: [],
		},
	});

	const { text } = await Effect.runPromise(generate(model));

	expect(text).toBe("A title");
	expect(quota.calls.finalize[0]?.steps).toMatchObject([
		{
			inputTokens: 12,
			outputTokens: 3,
			totalTokens: 15,
		},
	]);
});

test("a failed generation releases its reservation", async () => {
	const model = new MockLanguageModelV4({
		doGenerate: () => Promise.reject(new Error("provider down")),
	});

	const error = await Effect.runPromise(Effect.flip(generate(model)));

	expect(aiFailure(aiError(error))).toBe("model");
	expect(quota.calls.finalize).toEqual([]);
	expect(quota.calls.release[0]?.reason).toBe("provider_failure");
});

test("a reply that does not match the structured output is charged and fails", async () => {
	const error = await Effect.runPromise(
		Effect.flip(
			generateTitle(
				reply({
					text: "not json",
					finishReason: "stop",
					outputTokens: 2,
				}),
			),
		),
	);

	expect(error).toMatchObject({
		_tag: "AiError",
	});
	expect(aiFailure(aiError(error))).toBe("answer");
	expect(quota.calls.release).toEqual([]);
	expect(quota.calls.finalize[0]?.steps).toMatchObject([
		{
			inputTokens: 20,
			outputTokens: 2,
		},
	]);
});

test("a reply cut off at its budget before any text is charged and fails as cut off", async () => {
	const error = await Effect.runPromise(
		Effect.flip(
			generateTitle(
				reply({
					text: "",
					finishReason: "length",
					outputTokens: 1024,
					reasoningTokens: 1024,
				}),
			),
		),
	);

	expect(aiFailure(aiError(error))).toBe("output_limit");
	expect(failedReply(aiError(error))).toEqual({
		finishReason: "length",
		inputTokens: 20,
		outputTokens: 1024,
		reasoningTokens: 1024,
	});
	expect(quota.calls.release).toEqual([]);
	expect(quota.calls.finalize[0]?.steps).toMatchObject([
		{
			outputTokens: 1024,
		},
	]);
});

test("a reply cut off inside its object fails as cut off", async () => {
	const error = await Effect.runPromise(
		Effect.flip(
			generateTitle(
				reply({
					text: '{"title": "Refu',
					finishReason: "length",
					outputTokens: 1024,
				}),
			),
		),
	);

	expect(aiFailure(aiError(error))).toBe("output_limit");
	expect(quota.calls.finalize[0]?.steps).toMatchObject([
		{
			outputTokens: 1024,
		},
	]);
});

test("a structured reply inside a code fence parses", async () => {
	const model = new MockLanguageModelV4({
		doGenerate: {
			content: [
				{
					type: "text",
					text: '```json\n{"title": "Refunds"}\n```',
				},
			],
			finishReason: {
				unified: "stop",
				raw: undefined,
			},
			usage: {
				inputTokens: {
					total: 20,
					noCache: 20,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: 8,
					text: 8,
					reasoning: undefined,
				},
			},
			warnings: [],
		},
	});

	const { output } = await Effect.runPromise(
		withQuotaServices(
			generateTextWithQuota({
				operation: "test.generate",
				appRequestId: "request-1",
				organizationId: "org-1" as OrganizationId,
				userId: "user-1" as UserId,
				providerId: "provider-1" as ProviderId,
				modelId: "model-1" as ModelId,
				model,
				prompt: "Describe this.",
				output: Output.object({
					schema: z.object({
						title: z.string(),
					}),
				}),
			}),
		),
	);

	expect(output).toEqual({
		title: "Refunds",
	});
});
