import { describe, expect, test } from "bun:test";
import { setTourStateInputSchema } from "../src";

describe("setTourStateInputSchema", () => {
	test("rejects states the stored preferences cannot hold", () => {
		expect(
			setTourStateInputSchema.safeParse({
				tourId: "initialTour",
				state: "pending",
			}).success,
		).toBe(false);
	});

	test("rejects unknown tours", () => {
		expect(
			setTourStateInputSchema.safeParse({
				tourId: "unknownTour",
				state: "completed",
			}).success,
		).toBe(false);
	});
});
