import { describe, expect, test } from "bun:test";
import { createProviderInputSchema, updateProviderInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

const fields = {
	name: "Provider",
	description: "",
	endpoint: "https://api.example.com/v1",
	compatibility: "openai",
	meteringMode: "tokens",
	apiKey: "sk-test",
	enabled: true,
} as const;

describe("createProviderInputSchema", () => {
	test("requires a non-blank API key", () => {
		expect(createProviderInputSchema.safeParse(fields).success).toBe(true);
		expect(
			createProviderInputSchema.safeParse({
				...fields,
				apiKey: "",
			}).success,
		).toBe(false);
		expect(
			createProviderInputSchema.safeParse({
				...fields,
				apiKey: "   ",
			}).success,
		).toBe(false);
	});
});

describe("updateProviderInputSchema", () => {
	test("leaves the API key out when none is given", () => {
		const result = updateProviderInputSchema.parse({
			id,
			name: "Renamed",
		});

		expect(Object.keys(result).sort()).toEqual([
			"id",
			"name",
		]);
	});

	test("rejects a blank API key", () => {
		expect(
			updateProviderInputSchema.safeParse({
				id,
				apiKey: "",
			}).success,
		).toBe(false);
		expect(
			updateProviderInputSchema.safeParse({
				id,
				apiKey: "   ",
			}).success,
		).toBe(false);
	});

	test("accepts a new API key", () => {
		expect(
			updateProviderInputSchema.parse({
				id,
				apiKey: " sk-new ",
			}).apiKey,
		).toBe("sk-new");
	});
});
