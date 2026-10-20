import { describe, expect, test } from "bun:test";
import { createBlockInputSchema, updateBlockInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

const template = {
	type: "template",
	name: "Tutor",
	status: "draft",
	config: {
		systemPrompt: "Explain step by step.",
	},
};

const database = {
	type: "database",
	name: "Readings",
	status: "draft",
	config: {
		minReferences: 1,
		maxReferences: 5,
		defaultReferences: 3,
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
	test("accepts template and database blocks", () => {
		expect(createBlockInputSchema.safeParse(template).success).toBe(true);
		expect(createBlockInputSchema.safeParse(database).success).toBe(true);
	});

	test("rejects image generation blocks", () => {
		expect(createBlockInputSchema.safeParse(imageGeneration).success).toBe(
			false,
		);
	});
});

describe("updateBlockInputSchema", () => {
	test("accepts template and database blocks", () => {
		expect(
			updateBlockInputSchema.safeParse({
				...template,
				id,
			}).success,
		).toBe(true);
		expect(
			updateBlockInputSchema.safeParse({
				...database,
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
