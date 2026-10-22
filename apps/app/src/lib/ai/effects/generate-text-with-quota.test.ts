import { beforeEach, expect, test } from "bun:test";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import { MockLanguageModelV4 } from "ai/test";
import * as Effect from "effect/Effect";
import { quota, withQuotaServices } from "@/lib/ai/metered-call/test-quota";
import { generateTextWithQuota } from "./generate-text-with-quota";

const generate = (model: MockLanguageModelV4) =>
	withQuotaServices(
		generateTextWithQuota({
			operation: "test.generate",
			appRequestId: "request-1",
			organizationId: "org-1" as OrganizationId,
			userId: "user-1" as UserId,
			providerId: "provider-1" as ProviderId,
			modelId: "model-1",
			model,
			prompt: "Name this chat.",
		}),
	);

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

	await Effect.runPromise(Effect.flip(generate(model)));

	expect(quota.calls.finalize).toEqual([]);
	expect(quota.calls.release[0]?.reason).toBe("provider_failure");
});
