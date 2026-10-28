import { describe, expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import type { BotSetup } from "@orcai/schema";
import { effectiveModel, seededConfig } from "./effective-model";

const chatModel = {
	modelId: crypto.randomUUID() as ModelId,
	providerId: crypto.randomUUID() as ProviderId,
};
const botModel = {
	id: crypto.randomUUID() as ModelId,
	name: "Tutor model",
	providerId: crypto.randomUUID() as ProviderId,
	usable: true,
};
const setup = (
	strength: BotSetup["strength"],
	model: BotSetup["model"] = botModel,
): BotSetup => ({
	model,
	strength,
	generation: {
		temperature: 0.2,
	},
});

describe("effectiveModel", () => {
	test("a chat without a bot setup uses its own config", () => {
		expect(
			effectiveModel(
				{
					...chatModel,
					temperature: 1,
				},
				null,
			),
		).toEqual({
			...chatModel,
			generation: {
				temperature: 1,
			},
			source: "chat",
			botSetup: null,
		});
	});

	test("a recommended setup leaves the chat on what it was seeded with or switched to", () => {
		expect(
			effectiveModel(
				{
					...chatModel,
					maxTokens: 500,
				},
				setup("recommended"),
			),
		).toMatchObject({
			...chatModel,
			generation: {
				maxTokens: 500,
			},
			source: "chat",
		});
	});

	test("a required setup overrides the chat's model and settings", () => {
		expect(
			effectiveModel(
				{
					...chatModel,
					temperature: 1,
				},
				setup("required"),
			),
		).toMatchObject({
			modelId: botModel.id,
			providerId: botModel.providerId,
			generation: {
				temperature: 0.2,
			},
			source: "bot-required",
		});
	});

	test("a required setup whose model was deleted leaves no model", () => {
		expect(effectiveModel(chatModel, setup("required", null))).toMatchObject({
			modelId: null,
			providerId: null,
			source: "bot-required",
		});
	});
});

describe("seededConfig", () => {
	test("a recommended setup fills what the new chat does not choose", () => {
		expect(seededConfig(chatModel, setup("recommended"))).toEqual({
			...chatModel,
			temperature: 0.2,
		});
		expect(seededConfig({}, setup("recommended"))).toEqual({
			modelId: botModel.id,
			providerId: botModel.providerId,
			temperature: 0.2,
		});
	});

	test("a required setup wins over the requested model", () => {
		expect(seededConfig(chatModel, setup("required"))).toEqual({
			modelId: botModel.id,
			providerId: botModel.providerId,
			temperature: 0.2,
		});
	});

	test("without a setup the requested config stays", () => {
		expect(seededConfig(chatModel, null)).toEqual(chatModel);
	});
});
