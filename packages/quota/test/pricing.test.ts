import { describe, expect, test } from "bun:test";
import { type PriceList, priceSteps } from "../src/pricing";

const UNSET = {
	input: null,
	cacheRead: null,
	cacheWrite: null,
	output: null,
	request: null,
	webSearch: null,
};

const modelPrices = (
	model: Partial<NonNullable<PriceList["model"]>>,
	list: Partial<PriceList> = {},
): PriceList => ({
	currency: "USD",
	reportsCost: false,
	model: {
		...UNSET,
		...model,
	},
	search: null,
	...list,
});

const UNPRICED = {
	cost: null,
	currency: null,
	costSource: null,
};

describe("priceSteps", () => {
	test("prices each token class per 1M tokens", () => {
		expect(
			priceSteps(
				[
					{
						inputTokens: 1_350_000,
						noCacheInputTokens: 50_000,
						cacheReadTokens: 1_000_000,
						cacheWriteTokens: 300_000,
						outputTokens: 400_000,
						reasoningTokens: 300_000,
					},
				],
				modelPrices({
					input: 3,
					cacheRead: 0.3,
					cacheWrite: 3.75,
					output: 15,
				}),
			),
		).toEqual({
			// 0.15 + 0.30 + 1.125 + 6.00; reasoning is inside the output.
			cost: 7_575_000,
			currency: "USD",
			costSource: "estimated",
		});
	});

	test("prices cache tokens at the input price when their prices are unset", () => {
		expect(
			priceSteps(
				[
					{
						noCacheInputTokens: 1_000,
						cacheReadTokens: 2_000,
						cacheWriteTokens: 3_000,
						outputTokens: 0,
					},
				],
				modelPrices({
					input: 2,
					output: 8,
				}),
			).cost,
		).toBe(12_000);
	});

	test("counts input without a split as uncached", () => {
		expect(
			priceSteps(
				[
					{
						inputTokens: 1_500,
						cacheReadTokens: 500,
					},
				],
				modelPrices({
					input: 2,
					cacheRead: 1,
					output: 8,
				}),
			).cost,
		).toBe(2_500);
	});

	test.each([
		[
			"input",
			{
				output: 15,
			},
		],
		[
			"output",
			{
				input: 3,
			},
		],
	] as const)("leaves a model without an %s price unpriced", (_, prices) => {
		expect(
			priceSteps(
				[
					{
						inputTokens: 10,
						outputTokens: 10,
					},
				],
				modelPrices(prices),
			),
		).toEqual(UNPRICED);
	});

	test("leaves a call without prices unpriced, even without steps", () => {
		expect(priceSteps([], null)).toEqual(UNPRICED);
		expect(priceSteps([], modelPrices({}))).toEqual(UNPRICED);
	});

	test("adds the price per request and per native web search", () => {
		expect(
			priceSteps(
				[
					{
						webSearches: 2,
					},
					{
						webSearches: 1,
					},
				],
				modelPrices({
					input: 3,
					output: 15,
					request: 0.001,
					webSearch: 0.01,
				}),
			).cost,
		).toBe(32_000);
	});

	test("counts unset request and search prices of a priced model as free", () => {
		expect(
			priceSteps(
				[
					{
						webSearches: 3,
					},
				],
				modelPrices({
					input: 3,
					output: 15,
				}),
			),
		).toEqual({
			cost: 0,
			currency: "USD",
			costSource: "estimated",
		});
	});

	test("prices a search provider per search", () => {
		const tavily = (search: number | null): PriceList => ({
			currency: "EUR",
			reportsCost: false,
			model: null,
			search,
		});

		expect(
			priceSteps(
				[
					{},
				],
				tavily(0.008),
			),
		).toEqual({
			cost: 8_000,
			currency: "EUR",
			costSource: "estimated",
		});
		expect(
			priceSteps(
				[
					{},
				],
				tavily(null),
			),
		).toEqual(UNPRICED);
	});

	test("rounds the call's cost to micro-units once", () => {
		const step = {
			noCacheInputTokens: 1,
		};

		expect(
			priceSteps(
				[
					step,
					step,
					step,
				],
				modelPrices({
					input: 0.4,
					output: 1,
				}),
			).cost,
		).toBe(1);
	});

	test("takes the currency from the provider", () => {
		expect(
			priceSteps(
				[
					{
						outputTokens: 1_000_000,
					},
				],
				modelPrices(
					{
						input: 1,
						output: 9.5,
					},
					{
						currency: "EUR",
					},
				),
			),
		).toEqual({
			cost: 9_500_000,
			currency: "EUR",
			costSource: "estimated",
		});
	});

	describe("with reported costs", () => {
		const reporting = (model: Partial<NonNullable<PriceList["model"]>>) =>
			modelPrices(model, {
				reportsCost: true,
			});

		test("is reported when every step reported its cost", () => {
			expect(
				priceSteps(
					[
						{
							outputTokens: 1_000,
							reportedCost: 0.0012,
						},
						{
							outputTokens: 1_000,
							reportedCost: 0.0005,
						},
					],
					reporting({}),
				),
			).toEqual({
				cost: 1_700,
				currency: "USD",
				costSource: "reported",
			});
		});

		test("prices the steps without one and is estimated", () => {
			expect(
				priceSteps(
					[
						{
							outputTokens: 1_000,
							reportedCost: 0.0012,
						},
						{
							outputTokens: 1_000,
						},
					],
					reporting({
						input: 1,
						output: 2,
					}),
				),
			).toEqual({
				cost: 3_200,
				currency: "USD",
				costSource: "estimated",
			});
		});

		test("is unpriced when a step without one has no prices", () => {
			expect(
				priceSteps(
					[
						{
							reportedCost: 0.0012,
						},
						{
							outputTokens: 1_000,
						},
					],
					reporting({}),
				),
			).toEqual(UNPRICED);
		});

		test("is estimated when no step reported one", () => {
			expect(
				priceSteps(
					[
						{
							outputTokens: 1_000,
						},
					],
					reporting({
						input: 1,
						output: 2,
					}),
				).costSource,
			).toBe("estimated");
		});

		test("is ignored unless the provider reports costs", () => {
			expect(
				priceSteps(
					[
						{
							outputTokens: 1_000,
							reportedCost: 5,
						},
					],
					modelPrices({
						input: 1,
						output: 2,
					}),
				),
			).toEqual({
				cost: 2_000,
				currency: "USD",
				costSource: "estimated",
			});
		});
	});
});
