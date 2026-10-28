import { describe, expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import type { BotSetup } from "@orcai/schema";
import { modelPickerState, starterModel } from "./model-picker-state";

const tutor = {
	id: crypto.randomUUID() as ModelId,
	name: "Tutor model",
	providerId: crypto.randomUUID() as ProviderId,
	usable: true,
};
const other = crypto.randomUUID() as ModelId;
const setup = (strength: BotSetup["strength"]): BotSetup => ({
	model: tutor,
	strength,
	generation: {},
});

describe("modelPickerState", () => {
	test("a required setup locks the picker on its model", () => {
		expect(
			modelPickerState({
				source: "bot-required",
				modelId: tutor.id,
				botSetup: setup("required"),
			}),
		).toEqual({
			kind: "locked",
			modelName: "Tutor model",
		});
	});

	test("a required model that was deleted stays locked without a name", () => {
		expect(
			modelPickerState({
				source: "bot-required",
				modelId: null,
				botSetup: {
					...setup("required"),
					model: null,
				},
			}),
		).toEqual({
			kind: "locked",
			modelName: null,
		});
	});

	test("switching away from a recommended model shows what the bot is tuned for", () => {
		expect(
			modelPickerState({
				source: "chat",
				modelId: other,
				botSetup: setup("recommended"),
			}),
		).toEqual({
			kind: "tuned",
			modelName: "Tutor model",
		});
		expect(
			modelPickerState({
				source: "chat",
				modelId: tutor.id,
				botSetup: setup("recommended"),
			}),
		).toEqual({
			kind: "free",
		});
	});

	test("without a setup the picker is free", () => {
		expect(
			modelPickerState({
				source: "chat",
				modelId: other,
				botSetup: null,
			}),
		).toEqual({
			kind: "free",
		});
	});
});

describe("starterModel", () => {
	const fallback = {
		modelId: other,
		providerId: crypto.randomUUID() as ProviderId,
	};
	const ofTutor = {
		modelId: tutor.id,
		providerId: tutor.providerId,
	};
	const unusable = (strength: BotSetup["strength"]): BotSetup => ({
		...setup(strength),
		model: {
			...tutor,
			usable: false,
		},
	});

	test("a required model is fixed, usable or not", () => {
		for (const required of [
			setup("required"),
			unusable("required"),
		]) {
			expect(
				starterModel({
					setup: required,
					picked: fallback,
					defaultPick: fallback,
				}),
			).toEqual(ofTutor);
		}
	});

	test("the user's pick wins over a recommendation", () => {
		expect(
			starterModel({
				setup: setup("recommended"),
				picked: fallback,
				defaultPick: undefined,
			}),
		).toEqual(fallback);
	});

	test("a usable recommendation comes before the default", () => {
		expect(
			starterModel({
				setup: setup("recommended"),
				picked: null,
				defaultPick: fallback,
			}),
		).toEqual(ofTutor);
	});

	test("an unusable recommendation falls back to the default", () => {
		expect(
			starterModel({
				setup: unusable("recommended"),
				picked: null,
				defaultPick: fallback,
			}),
		).toEqual(fallback);
	});
});
