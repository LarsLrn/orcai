import { describe, expect, test } from "bun:test";
import { createProviderInputSchema, updateProviderInputSchema } from "../src";

const id = "11111111-1111-4111-8111-111111111111";

const fields = {
	name: "Provider",
	description: "",
	endpoint: "https://api.example.com/v1",
	kind: "openai-compatible",
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

describe("createProviderInputSchema endpoint", () => {
	const reasonsOf = (input: unknown) =>
		createProviderInputSchema
			.safeParse(input)
			.error?.issues.map((issue) =>
				"params" in issue ? issue.params?.reason : issue.code,
			);

	test("requires an endpoint for OpenAI-compatible providers", () => {
		expect(
			reasonsOf({
				...fields,
				endpoint: null,
			}),
		).toEqual([
			"PROVIDER_ENDPOINT_REQUIRED",
		]);
	});

	test("rejects an endpoint for official kinds", () => {
		for (const kind of [
			"openai",
			"anthropic",
		]) {
			expect(
				reasonsOf({
					...fields,
					kind,
				}),
			).toEqual([
				"PROVIDER_ENDPOINT_NOT_ALLOWED",
			]);
			expect(
				createProviderInputSchema.safeParse({
					...fields,
					kind,
					endpoint: null,
				}).success,
			).toBe(true);
		}
	});
});

describe("updateProviderInputSchema", () => {
	test("leaves the kind out", () => {
		expect(
			Object.keys(
				updateProviderInputSchema.parse({
					id,
					kind: "anthropic",
				}),
			),
		).toEqual([
			"id",
		]);
	});

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
