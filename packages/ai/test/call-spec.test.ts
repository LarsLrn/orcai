import { beforeEach, describe, expect, test } from "bun:test";
import type {
	ModelId,
	ModelProviderKind,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import { quota, withQuotaServices } from "@orcai/quota/testing";
import { MockLanguageModelV4 } from "ai/test";
import * as Effect from "effect/Effect";
import { assetMetadataCall } from "../src/asset-metadata";
import type { CallOutput, CallSpec } from "../src/call-spec";
import { chatTitleCall } from "../src/chat-title";
import { figureCall, imageAssetCall } from "../src/image-description";
import { generateTextWithQuota } from "../src/metered/generate-text-with-quota";
import { summaryCall } from "../src/summary";

beforeEach(() => {
	quota.reset();
});

const image = {
	data: new Uint8Array([
		1,
		2,
		3,
	]),
	mediaType: "image/png",
	locale: "en",
};

const calls: Record<string, (kind: ModelProviderKind) => CallSpec<CallOutput>> =
	{
		title: (kind) => chatTitleCall(kind, "How fast are refunds paid?"),
		summary: (kind) =>
			summaryCall(kind, {
				transcript: "User:\nHi",
				turnMaxOutputTokens: 16_384,
			}),
		metadata: (kind) =>
			assetMetadataCall(kind, {
				content: "Refund policy",
				hints: {},
			}),
		imageAsset: (kind) => imageAssetCall(kind, image),
		figure: (kind) => figureCall(kind, image),
	};

/** What the provider receives for `call`, whatever the reply. */
const received = async (call: CallSpec<CallOutput>) => {
	const model = new MockLanguageModelV4({
		doGenerate: {
			content: [
				{
					type: "text",
					text: "{}",
				},
			],
			finishReason: {
				unified: "stop",
				raw: undefined,
			},
			usage: {
				inputTokens: {
					total: 10,
					noCache: 10,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: 1,
					text: 1,
					reasoning: undefined,
				},
			},
			warnings: [],
		},
	});
	await Effect.runPromise(
		Effect.exit(
			withQuotaServices(
				generateTextWithQuota({
					appRequestId: "request-1",
					organizationId: "org-1" as OrganizationId,
					userId: "user-1" as UserId,
					providerId: "provider-1" as ProviderId,
					modelId: "model-1" as ModelId,
					model,
					call,
				}),
			),
		),
	);
	const [request] = model.doGenerateCalls;
	if (!request) throw new Error("The call sent no request.");
	return request;
};

describe("background calls", () => {
	for (const [name, call] of Object.entries(calls)) {
		test(`${name} sends OpenAI's store setting and no turn options`, async () => {
			expect((await received(call("openai"))).providerOptions).toEqual({
				openai: {
					store: false,
				},
			});
			expect(
				(await received(call("anthropic"))).providerOptions,
			).toBeUndefined();
			expect(
				(await received(call("openai-compatible"))).providerOptions,
			).toBeUndefined();
		});
	}

	test("utility calls ask for the kind's reasoning, the title turns it off on Anthropic", async () => {
		expect((await received(calls.metadata("openai"))).reasoning).toBe("low");
		expect((await received(calls.figure("anthropic"))).reasoning).toBe("none");
		expect(await received(calls.title("anthropic"))).toMatchObject({
			reasoning: "none",
			maxOutputTokens: 256,
		});
	});

	test("a summary stays within the turn's output cap", async () => {
		const small = summaryCall("anthropic", {
			transcript: "User:\nHi",
			turnMaxOutputTokens: 1_000,
		});

		expect((await received(small)).maxOutputTokens).toBe(1_000);
		expect((await received(calls.summary("anthropic"))).maxOutputTokens).toBe(
			8_192,
		);
	});
});
