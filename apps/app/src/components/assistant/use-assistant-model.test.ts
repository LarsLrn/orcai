import { describe, expect, mock, test } from "bun:test";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { assistantModelAvailability } = await import("./use-assistant-model");

describe("assistantModelAvailability", () => {
	test("waits for the organisation", () => {
		expect(
			assistantModelAvailability({
				organizationStatus: "pending",
				modelId: null,
				modelMissing: false,
			}),
		).toBe("loading");
	});

	test("is set while the named model exists, even when a refetch fails otherwise", () => {
		expect(
			assistantModelAvailability({
				organizationStatus: "success",
				modelId: "model-1",
				modelMissing: false,
			}),
		).toBe("set");
	});

	test("is unset without a model, or when the named model is gone", () => {
		expect(
			assistantModelAvailability({
				organizationStatus: "success",
				modelId: null,
				modelMissing: false,
			}),
		).toBe("unset");
		expect(
			assistantModelAvailability({
				organizationStatus: "success",
				modelId: "deleted-model",
				modelMissing: true,
			}),
		).toBe("unset");
	});
});
