import { describe, expect, test } from "bun:test";
import type { Plan, PlanItemStatus } from "./plan";
import { isPlanFinished, planCounts, planTally } from "./plan-tally";

const items = (...statuses: PlanItemStatus[]): Plan["items"] =>
	statuses.map((status, index) => ({
		label: `Step ${index + 1}`,
		status,
	}));

describe("planCounts", () => {
	test("counts done, skipped and every item", () => {
		expect(
			planCounts(items("done", "skipped", "in_progress", "pending", "done")),
		).toEqual({
			done: 2,
			skipped: 1,
			total: 5,
		});
	});
});

describe("planTally", () => {
	test("counts the done steps", () => {
		expect(
			planTally(items("done", "done", "in_progress", "pending", "pending")),
		).toBe("2 of 5 done");
	});

	test("adds the skipped steps when there are any", () => {
		expect(
			planTally(items("done", "done", "skipped", "pending", "pending")),
		).toBe("2 of 5 done, 1 skipped");
	});
});

describe("isPlanFinished", () => {
	test("is finished once every step is done or skipped", () => {
		expect(isPlanFinished(items("done", "skipped", "done"))).toBe(true);
	});

	test.each([
		"pending",
		"in_progress",
	] as const)("is not finished while a step is %s", (status) => {
		expect(isPlanFinished(items("done", status))).toBe(false);
	});
});
