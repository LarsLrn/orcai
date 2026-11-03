import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import { z } from "zod/v4";
import type { FeatureCatalog, FeatureEntry } from "./catalog";
import { resolveFeatures } from "./resolve-features";

const entry = (settingsSchema: z.ZodType): FeatureEntry => ({
	settingsSchema,
	buildTools: () => ({}),
	prompt: () => "",
});

const catalog: FeatureCatalog = {
	base: entry(
		z.object({
			level: z.number().default(1),
		}),
	),
	dependent: entry(z.object({})),
};

const logged: string[] = [];
const logger = Logger.make(({ logLevel, message }) => {
	logged.push(`${logLevel} ${(message as unknown[]).join(" ")}`);
});

const resolve = (features: unknown) =>
	Effect.runSync(
		resolveFeatures(features, catalog).pipe(
			Effect.provide(
				Logger.layer([
					logger,
				]),
			),
		),
	).map(({ id, settings }) => ({
		id,
		settings,
	}));

beforeEach(() => {
	logged.length = 0;
});

describe("resolveFeatures", () => {
	test("returns enabled entries with parsed settings in catalog order", () => {
		expect(
			resolve({
				dependent: {},
				base: {},
			}),
		).toEqual([
			{
				id: "base",
				settings: {
					level: 1,
				},
			},
			{
				id: "dependent",
				settings: {},
			},
		]);
		expect(logged).toEqual([]);
	});

	test("resolves nothing for a missing or malformed map", () => {
		expect(resolve(undefined)).toEqual([]);
		expect(resolve(null)).toEqual([]);
		expect(resolve("base")).toEqual([]);
		expect(
			resolve([
				"base",
			]),
		).toEqual([]);
	});

	test("skips an unknown id with a warning", () => {
		expect(
			resolve({
				base: {},
				retired: {},
			}),
		).toEqual([
			{
				id: "base",
				settings: {
					level: 1,
				},
			},
		]);
		expect(logged).toEqual([
			"Warn feature.skipped id=retired reason=unknown",
		]);
	});

	test("skips settings that no longer parse with a warning", () => {
		expect(
			resolve({
				base: {
					level: "high",
				},
			}),
		).toEqual([]);
		expect(logged).toEqual([
			"Warn feature.skipped id=base reason=invalid_settings",
		]);
	});
});
