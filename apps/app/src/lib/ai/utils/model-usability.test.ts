import { describe, expect, test } from "bun:test";
import { modelUnusableReason } from "./model-usability";

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
		expect(modelUnusableReason(usable)).toBeUndefined();
	});

	test("each failing check names its reason", () => {
		expect(
			modelUnusableReason({
				...usable,
				providerEnabled: false,
			}),
		).toBe("PROVIDER_DISABLED");
		expect(
			modelUnusableReason({
				...usable,
				isDeprecated: true,
			}),
		).toBe("MODEL_DEPRECATED");
		expect(
			modelUnusableReason({
				...usable,
				capabilities: [
					"text",
				],
			}),
		).toBe("MODEL_TOOLS_UNSUPPORTED");
	});

	test("the first failing check wins", () => {
		expect(
			modelUnusableReason({
				capabilities: [],
				isDeprecated: true,
				providerEnabled: false,
			}),
		).toBe("PROVIDER_DISABLED");
		expect(
			modelUnusableReason({
				capabilities: [],
				isDeprecated: true,
				providerEnabled: true,
			}),
		).toBe("MODEL_DEPRECATED");
	});
});
