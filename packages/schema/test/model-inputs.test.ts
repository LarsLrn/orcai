import { describe, expect, test } from "bun:test";
import { createModelInputSchema, updateModelInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

const fields = {
	providerId: id,
	providerModelId: "gpt-x",
	name: "GPT X",
	description: "",
	isDeprecated: false,
	capabilities: [],
};

describe("model token limits", () => {
	test("are optional and may be unknown", () => {
		for (const limits of [
			{},
			{
				contextWindow: null,
				maxOutputTokens: null,
			},
			{
				contextWindow: 128_000,
				maxOutputTokens: 16_384,
			},
		]) {
			expect(
				createModelInputSchema.safeParse({
					...fields,
					...limits,
				}).success,
			).toBe(true);
		}
	});

	test("are positive whole token counts a database integer holds", () => {
		for (const contextWindow of [
			0,
			-1,
			1.5,
			2 ** 31,
		]) {
			expect(
				createModelInputSchema.safeParse({
					...fields,
					contextWindow,
				}).success,
			).toBe(false);
			expect(
				updateModelInputSchema.safeParse({
					id,
					maxOutputTokens: contextWindow,
				}).success,
			).toBe(false);
		}
	});

	test("an update leaves out what it does not change", () => {
		expect(
			Object.keys(
				updateModelInputSchema.parse({
					id,
					name: "GPT X",
				}),
			).sort(),
		).toEqual([
			"id",
			"name",
		]);
	});
});
