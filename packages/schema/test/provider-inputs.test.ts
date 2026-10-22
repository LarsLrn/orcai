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

describe("createProviderInputSchema search providers", () => {
	const tavily = {
		...fields,
		kind: "tavily",
		meteringMode: "requests",
	} as const;
	const reasonsOf = (input: unknown) =>
		createProviderInputSchema
			.safeParse(input)
			.error?.issues.map((issue) =>
				"params" in issue ? issue.params?.reason : issue.code,
			);

	test("take an endpoint or none", () => {
		expect(createProviderInputSchema.safeParse(tavily).success).toBe(true);
		expect(
			createProviderInputSchema.safeParse({
				...tavily,
				endpoint: null,
			}).success,
		).toBe(true);
	});

	test("meter requests only", () => {
		expect(
			reasonsOf({
				...tavily,
				meteringMode: "tokens",
			}),
		).toEqual([
			"PROVIDER_METERING_MODE_NOT_ALLOWED",
		]);
	});
});

describe("createProviderInputSchema prices", () => {
	const reasonsOf = (input: unknown) =>
		createProviderInputSchema
			.safeParse(input)
			.error?.issues.map((issue) =>
				"params" in issue ? issue.params?.reason : issue.code,
			);

	test("default to USD, no reported cost and no search price", () => {
		expect(createProviderInputSchema.parse(fields)).toMatchObject({
			currency: "USD",
			reportsCost: false,
			searchPrice: null,
		});
	});

	test("take an ISO 4217 currency", () => {
		expect(
			createProviderInputSchema.parse({
				...fields,
				currency: "EUR",
			}).currency,
		).toBe("EUR");
		expect(
			createProviderInputSchema.safeParse({
				...fields,
				currency: "EURO",
			}).success,
		).toBe(false);
	});

	test("let only OpenAI-compatible providers report their cost, in USD", () => {
		expect(
			createProviderInputSchema.safeParse({
				...fields,
				reportsCost: true,
			}).success,
		).toBe(true);
		expect(
			reasonsOf({
				...fields,
				kind: "anthropic",
				endpoint: null,
				reportsCost: true,
			}),
		).toEqual([
			"PROVIDER_COST_REPORTING_NOT_ALLOWED",
		]);
		expect(
			reasonsOf({
				...fields,
				currency: "EUR",
				reportsCost: true,
			}),
		).toEqual([
			"PROVIDER_CURRENCY_NOT_ALLOWED",
		]);
	});

	test("price searches of search providers only", () => {
		expect(
			createProviderInputSchema.safeParse({
				...fields,
				kind: "tavily",
				meteringMode: "requests",
				searchPrice: 0.008,
			}).success,
		).toBe(true);
		expect(
			reasonsOf({
				...fields,
				searchPrice: 0.008,
			}),
		).toEqual([
			"PROVIDER_SEARCH_PRICE_NOT_ALLOWED",
		]);
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
