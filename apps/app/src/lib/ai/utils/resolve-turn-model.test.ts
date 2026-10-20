import { describe, expect, test } from "bun:test";
import { modelIdSchema, providerIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { checkTurnModel, requestedTurnModel } from "./resolve-turn-model";

const modelId = modelIdSchema.parse("3e0a7c81-6f4d-4a5e-9b2c-4d5e6f708192");
const providerId = providerIdSchema.parse(
	"4f1b8d92-7a5e-4b6f-8c3d-5e6f708192a3",
);

describe("requestedTurnModel", () => {
	test("a chat asks for its configured model and provider", () => {
		expect(
			Effect.runSync(
				requestedTurnModel({
					kind: "chat",
					config: {
						modelId,
						providerId,
					},
					assistantModelId: null,
				}),
			),
		).toEqual({
			modelId,
			providerId,
		});
	});

	test("a chat without a configured model is refused", () => {
		expect(
			Effect.runSync(
				Effect.flip(
					requestedTurnModel({
						kind: "chat",
						config: {
							modelId,
						},
						assistantModelId: modelId,
					}),
				),
			).reason,
		).toBe("CHAT_MODEL_NOT_CONFIGURED");
	});

	test("an assistant conversation asks for the organisation's model, whatever its config says", () => {
		const assistantModelId = modelIdSchema.parse(
			"5a2c9ea3-8b6f-4c70-9d4e-6f708192a3b4",
		);

		expect(
			Effect.runSync(
				requestedTurnModel({
					kind: "assistant",
					config: {
						modelId,
						providerId,
					},
					assistantModelId,
				}),
			),
		).toEqual({
			modelId: assistantModelId,
			providerId: undefined,
		});
	});

	test("an assistant conversation without an organisation model is refused", () => {
		expect(
			Effect.runSync(
				Effect.flip(
					requestedTurnModel({
						kind: "assistant",
						config: {},
						assistantModelId: null,
					}),
				),
			).reason,
		).toBe("ASSISTANT_MODEL_NOT_CONFIGURED");
	});
});

describe("checkTurnModel", () => {
	test("a model missing from the active organisation is not found", () => {
		expect(
			Effect.runSync(
				Effect.flip(
					checkTurnModel({
						modelId,
						model: undefined,
					}),
				),
			).reason,
		).toBe("MODEL_NOT_FOUND");
	});

	test("a model without tool calling is refused", () => {
		expect(
			Effect.runSync(
				Effect.flip(
					checkTurnModel({
						modelId,
						model: {
							providerId,
							capabilities: [
								"text",
							],
						},
					}),
				),
			).reason,
		).toBe("MODEL_TOOLS_UNSUPPORTED");
	});

	test("a tool-calling model passes", () => {
		const model = {
			providerId,
			capabilities: [
				"text" as const,
				"tool-calling" as const,
			],
		};

		expect(
			Effect.runSync(
				checkTurnModel({
					modelId,
					model,
				}),
			),
		).toBe(model);
	});
});
