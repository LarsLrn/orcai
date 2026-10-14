import { describe, expect, test } from "bun:test";
import { singleTargetName } from "./destructive-target";

describe("singleTargetName", () => {
	test("returns a trimmed name for one target", () => {
		expect(
			singleTargetName(1, {
				names: [
					"  Ada  ",
				],
			}),
		).toBe("Ada");
	});

	test("returns undefined without a usable name", () => {
		expect(singleTargetName(1)).toBeUndefined();
		expect(
			singleTargetName(1, {
				names: [
					"  ",
				],
			}),
		).toBeUndefined();
	});

	test("returns undefined for multiple targets", () => {
		expect(
			singleTargetName(2, {
				names: [
					"Ada",
					"Grace",
				],
			}),
		).toBeUndefined();
	});
});
