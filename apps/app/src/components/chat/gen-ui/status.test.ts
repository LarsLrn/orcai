import { describe, expect, test } from "bun:test";
import { tally } from "@/components/chat/gen-ui/status";

describe("tally", () => {
	test("counts not met, partial and met in that order", () => {
		expect(
			tally([
				"met",
				"partial",
				"not_met",
				"met",
				"not_met",
				"met",
			]),
		).toEqual([
			{
				status: "not_met",
				count: 2,
			},
			{
				status: "partial",
				count: 1,
			},
			{
				status: "met",
				count: 3,
			},
		]);
	});

	test("hides zero counts", () => {
		expect(
			tally([
				"met",
				"met",
			]),
		).toEqual([
			{
				status: "met",
				count: 2,
			},
		]);
		expect(tally([])).toEqual([]);
	});

	test("leaves out n_a and missing statuses", () => {
		expect(
			tally([
				"n_a",
				undefined,
				"partial",
				"n_a",
			]),
		).toEqual([
			{
				status: "partial",
				count: 1,
			},
		]);
	});
});
