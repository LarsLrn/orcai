import { afterEach, describe, expect, test } from "bun:test";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { formatFileSize } from "./format-file-size";

const originalGetLocale = getLocale;

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

describe("formatFileSize", () => {
	test("formats zero as bytes", () => {
		overwriteGetLocale(() => "en");

		expect(formatFileSize(0)).toBe("0 byte");
	});

	test("uses the active locale", () => {
		overwriteGetLocale(() => "de");

		expect(formatFileSize(1_500_000)).toBe("1,5 MB");
	});
});
