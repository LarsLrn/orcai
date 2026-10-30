import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Check } from "@orcai/schema";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { checkReasonMessage } from "./check-reason";

const originalGetLocale = getLocale;

beforeEach(() => {
	overwriteGetLocale(() => "en");
});

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

const configWarnings = (count: number): Check => ({
	id: "config",
	severity: "recommended",
	status: "warning",
	reason: "CONFIG_WARNINGS",
	params: {
		count,
	},
});

describe("checkReasonMessage", () => {
	test("uses the singular for one deployment warning", () => {
		expect(checkReasonMessage(configWarnings(1))).toBe(
			"1 deployment warning. Check the environment variables named below.",
		);
	});

	test("uses the plural for several deployment warnings", () => {
		expect(checkReasonMessage(configWarnings(2))).toBe(
			"2 deployment warnings. Check the environment variables named below.",
		);
	});
});
