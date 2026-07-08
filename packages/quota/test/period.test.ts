import { describe, expect, test } from "bun:test";
import { getUtcPeriodBounds } from "../src/period";

describe("getUtcPeriodBounds", () => {
	describe("weekly", () => {
		test("starts on monday and ends seven days later", () => {
			const at = new Date(Date.UTC(2026, 6, 8, 12, 0, 0)); // Wednesday
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "weekly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 6, 6, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2026, 6, 13, 0, 0, 0)));
		});

		test("handles sunday as the last day of the week", () => {
			const at = new Date(Date.UTC(2026, 6, 5, 12, 0, 0)); // Sunday
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "weekly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 5, 29, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2026, 6, 6, 0, 0, 0)));
		});

		test("handles monday as the first day of the week", () => {
			const at = new Date(Date.UTC(2026, 6, 6, 0, 0, 0)); // Monday
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "weekly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 6, 6, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2026, 6, 13, 0, 0, 0)));
		});
	});

	describe("monthly", () => {
		test("starts on the first and ends on the first of the next month", () => {
			const at = new Date(Date.UTC(2026, 6, 8, 12, 0, 0));
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "monthly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 6, 1, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2026, 7, 1, 0, 0, 0)));
		});

		test("handles month boundaries correctly", () => {
			const at = new Date(Date.UTC(2026, 11, 31, 23, 59, 59)); // December 31
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "monthly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 11, 1, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2027, 0, 1, 0, 0, 0)));
		});
	});

	describe("yearly", () => {
		test("starts on january first and ends on the next january first", () => {
			const at = new Date(Date.UTC(2026, 6, 8, 12, 0, 0));
			const bounds = getUtcPeriodBounds({
				at,
				periodType: "yearly",
			});

			expect(bounds.start).toEqual(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)));
			expect(bounds.end).toEqual(new Date(Date.UTC(2027, 0, 1, 0, 0, 0)));
		});
	});
});
