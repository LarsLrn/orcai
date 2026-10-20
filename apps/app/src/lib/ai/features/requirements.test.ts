import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import type { FeatureCatalog, FeatureEntry } from "./catalog";
import { checkFeatureRequirements } from "./requirements";

const entry = (requires: readonly string[]): FeatureEntry => ({
	settingsSchema: z.object({}),
	buildTools: () => ({}),
	prompt: "",
	requires,
});

const catalog: FeatureCatalog = {
	base: entry([]),
	dependent: entry([
		"base",
	]),
};

const run = (features: Record<string, unknown>) =>
	Effect.runSync(Effect.flip(checkFeatureRequirements(features, catalog)));

describe("checkFeatureRequirements", () => {
	test("passes when every enabled feature has its requirements", () => {
		for (const features of [
			{},
			{
				base: {},
			},
			{
				base: {},
				dependent: {},
			},
		]) {
			expect(
				Effect.runSync(checkFeatureRequirements(features, catalog)),
			).toBeUndefined();
		}
	});

	test("fails with the feature and its missing requirement", () => {
		const error = run({
			dependent: {},
		});

		expect(error._tag).toBe("BadRequestError");
		expect(error.reason).toBe("FEATURE_REQUIREMENT_MISSING");
		expect<unknown>(error.params).toEqual({
			feature: "dependent",
			requirement: "base",
		});
	});

	test("passes the shipped catalog", () => {
		expect(
			Effect.runSync(
				checkFeatureRequirements({
					generativeUi: {},
				}),
			),
		).toBeUndefined();
	});
});
