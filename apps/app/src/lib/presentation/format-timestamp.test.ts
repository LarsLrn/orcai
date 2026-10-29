import { afterEach, describe, expect, test } from "bun:test";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { formatRelativeTime } from "./format-timestamp";

const originalGetLocale = getLocale;

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

const now = Date.UTC(2026, 9, 28, 12);
const HOUR_MS = 3_600_000;

describe("formatRelativeTime", () => {
	test("counts days from a day away", () => {
		overwriteGetLocale(() => "en");

		expect(
			formatRelativeTime(now + 3 * 24 * HOUR_MS, {
				now,
			}),
		).toBe("in 3 days");
		expect(
			formatRelativeTime(now + 3 * 24 * HOUR_MS, {
				now,
				style: "narrow",
			}),
		).toBe("in 3d");
	});

	test("counts hours within a day and minutes within an hour", () => {
		overwriteGetLocale(() => "en");

		expect(
			formatRelativeTime(now + 5 * HOUR_MS, {
				now,
			}),
		).toBe("in 5 hours");
		expect(
			formatRelativeTime(now + 10_000, {
				now,
			}),
		).toBe("in 1 minute");
	});

	test("the last minute is just now, a minute ago counts, and the next minute stays ahead", () => {
		overwriteGetLocale(() => "en");

		expect(
			formatRelativeTime(now, {
				now,
			}),
		).toBe("just now");
		expect(
			formatRelativeTime(now - 59_999, {
				now,
				style: "narrow",
			}),
		).toBe("just now");
		expect(
			formatRelativeTime(now - 60_000, {
				now,
			}),
		).toBe("1 minute ago");
		expect(
			formatRelativeTime(now + 1_000, {
				now,
			}),
		).toBe("in 1 minute");
	});

	test("uses the active locale", () => {
		overwriteGetLocale(() => "de");

		expect(
			formatRelativeTime(now + 3 * 24 * HOUR_MS, {
				now,
			}),
		).toBe("in 3 Tagen");
		expect(
			formatRelativeTime(now + 5 * HOUR_MS, {
				now,
			}),
		).toBe("in 5 Stunden");
		expect(
			formatRelativeTime(now - 10_000, {
				now,
			}),
		).toBe("gerade eben");
	});
});
