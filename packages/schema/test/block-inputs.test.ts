import { describe, expect, test } from "bun:test";
import { createBlockInputSchema, updateBlockInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

const behaviour = {
	type: "behaviour",
	name: "Tutor",
	status: "draft",
	config: {
		systemPrompt: "Explain step by step.",
	},
};

const repository = {
	type: "repository",
	name: "Readings",
	status: "draft",
	config: {
		minPassages: 1,
		maxPassages: 5,
		defaultPassages: 3,
	},
	assets: [],
};

const imageGeneration = {
	type: "imageGeneration",
	name: "Illustrator",
	status: "draft",
	config: {
		provider: "openai",
		model: "gpt-image-1",
	},
};

describe("createBlockInputSchema", () => {
	test("accepts behaviours and repositories", () => {
		expect(createBlockInputSchema.safeParse(behaviour).success).toBe(true);
		expect(createBlockInputSchema.safeParse(repository).success).toBe(true);
	});

	test("rejects image generation blocks", () => {
		expect(createBlockInputSchema.safeParse(imageGeneration).success).toBe(
			false,
		);
	});
});

describe("updateBlockInputSchema", () => {
	test("accepts behaviours and repositories", () => {
		expect(
			updateBlockInputSchema.safeParse({
				...behaviour,
				id,
			}).success,
		).toBe(true);
		expect(
			updateBlockInputSchema.safeParse({
				...repository,
				id,
			}).success,
		).toBe(true);
	});

	test("rejects image generation blocks", () => {
		expect(
			updateBlockInputSchema.safeParse({
				...imageGeneration,
				id,
			}).success,
		).toBe(false);
	});
});
