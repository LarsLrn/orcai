import { describe, expect, test } from "bun:test";
import {
	chatConfigPatchSchema,
	chatConfigSchema,
	featuresSchema,
} from "../src";

describe("featuresSchema", () => {
	test("accepts an empty map and Generative UI", () => {
		expect(featuresSchema.parse({})).toEqual({});
		expect(
			featuresSchema.parse({
				generativeUi: {},
			}),
		).toEqual({
			generativeUi: {},
		});
	});

	test("strips unknown feature ids", () => {
		expect(
			featuresSchema.parse({
				generativeUi: {},
				unknown: {},
			}),
		).toEqual({
			generativeUi: {},
		});
	});
});

describe("chatConfigSchema", () => {
	test("keeps features", () => {
		expect(
			chatConfigSchema.parse({
				systemPrompt: "Be brief.",
				features: {
					generativeUi: {},
				},
			}),
		).toEqual({
			systemPrompt: "Be brief.",
			features: {
				generativeUi: {},
			},
		});
	});
});

describe("chatConfigPatchSchema", () => {
	test("accepts null to remove features", () => {
		expect(
			chatConfigPatchSchema.parse({
				features: null,
			}),
		).toEqual({
			features: null,
		});
	});
});
