import { describe, expect, test } from "bun:test";
import { isExhaustedShare, isLowShare, usedShareOf } from "./quota-share";

describe("usedShareOf", () => {
	test("counts everything not remaining as used", () => {
		expect(
			usedShareOf({
				budgetAmount: 200,
				remainingAmount: 150,
			}),
		).toBe(0.25);
	});

	test("stays within the budget", () => {
		expect(
			usedShareOf({
				budgetAmount: 100,
				remainingAmount: -20,
			}),
		).toBe(1);
		expect(
			usedShareOf({
				budgetAmount: 100,
				remainingAmount: 120,
			}),
		).toBe(0);
	});

	test("treats a zero budget as used up", () => {
		expect(
			usedShareOf({
				budgetAmount: 0,
				remainingAmount: 0,
			}),
		).toBe(1);
	});
});

describe("share thresholds", () => {
	test("a pool is low from 90% used", () => {
		expect(isLowShare(0.89)).toBe(false);
		expect(isLowShare(0.9)).toBe(true);
	});

	test("a pool is exhausted at 100% used", () => {
		expect(isExhaustedShare(0.99)).toBe(false);
		expect(isExhaustedShare(1)).toBe(true);
	});
});
