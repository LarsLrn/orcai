import { describe, expect, test } from "bun:test";
import { modelUnusableReason } from "../src";

const usable = {
	capabilities: [
		"text",
		"tool-calling",
	] as const,
	isDeprecated: false,
	providerEnabled: true,
};

describe("modelUnusableReason", () => {
	test("a usable model has no reason", () => {
		expect(modelUnusableReason(usable, "turn")).toBeUndefined();
		expect(modelUnusableReason(usable, "text")).toBeUndefined();
	});

	test("each failing check names its reason", () => {
		expect(
			modelUnusableReason(
				{
					...usable,
					providerEnabled: false,
				},
				"turn",
			),
		).toBe("PROVIDER_DISABLED");
		expect(
			modelUnusableReason(
				{
					...usable,
					isDeprecated: true,
				},
				"turn",
			),
		).toBe("MODEL_DEPRECATED");
		expect(
			modelUnusableReason(
				{
					...usable,
					capabilities: [
						"text",
					],
				},
				"turn",
			),
		).toBe("MODEL_TOOLS_UNSUPPORTED");
		expect(
			modelUnusableReason(
				{
					...usable,
					capabilities: [
						"embedding",
					],
				},
				"text",
			),
		).toBe("MODEL_TEXT_UNSUPPORTED");
	});

	test("text calls need no tool calling", () => {
		expect(
			modelUnusableReason(
				{
					...usable,
					capabilities: [
						"text",
					],
				},
				"text",
			),
		).toBeUndefined();
	});

	test("the first failing check wins", () => {
		expect(
			modelUnusableReason(
				{
					capabilities: [],
					isDeprecated: true,
					providerEnabled: false,
				},
				"turn",
			),
		).toBe("PROVIDER_DISABLED");
		expect(
			modelUnusableReason(
				{
					capabilities: [],
					isDeprecated: true,
					providerEnabled: true,
				},
				"text",
			),
		).toBe("MODEL_DEPRECATED");
	});
});
