import { describe, expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { type ModelRows, resolveModel } from "../src/resolve-model";

const rows = ({
	model = {},
	provider = {},
}: {
	model?: Partial<ModelRows["model"]>;
	provider?: Partial<ModelRows["provider"]>;
}): ModelRows => ({
	model: {
		id: "model-1" as ModelId,
		providerModelId: "claude-opus-5-5",
		capabilities: [
			"text",
		],
		isDeprecated: false,
		contextWindow: null,
		maxOutputTokens: null,
		...model,
	},
	provider: {
		id: "provider-1" as ProviderId,
		kind: "anthropic",
		endpoint: null,
		enabled: true,
		...provider,
	},
});

// A refused model never reads its key, so these run without the database.
const run = <A, E>(effect: Effect.Effect<A, E, unknown>) =>
	Effect.runPromise(Effect.result(effect as Effect.Effect<A, E, never>));

describe("resolveModel", () => {
	test("fails a turn on a model that cannot carry one, with the reason", async () => {
		const result = await run(
			resolveModel(rows({}), {
				purpose: "turn",
			}),
		);

		expect(result).toMatchObject({
			failure: {
				_tag: "ModelUnusableError",
				reason: "MODEL_TOOLS_UNSUPPORTED",
			},
		});
	});

	test("fails a turn on a search provider's model", async () => {
		const result = await run(
			resolveModel(
				rows({
					model: {
						capabilities: [
							"tool-calling",
						],
					},
					provider: {
						kind: "tavily",
					},
				}),
				{
					purpose: "turn",
				},
			),
		);

		expect(result).toMatchObject({
			failure: {
				reason: "PROVIDER_PURPOSE_MISMATCH",
			},
		});
	});

	test("leaves a text call without a model that cannot write text", async () => {
		const result = await run(
			resolveModel(
				rows({
					model: {
						isDeprecated: true,
					},
				}),
				{
					purpose: "text",
				},
			),
		);

		expect(Result.isSuccess(result)).toBe(true);
		expect(result).toMatchObject({
			success: undefined,
		});
	});
});
