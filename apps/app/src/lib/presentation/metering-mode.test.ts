import { afterEach, describe, expect, test } from "bun:test";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { getMeteringModeLabel, getMeteringUnit } from "./metering-mode";

const originalGetLocale = getLocale;

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

describe("getMeteringModeLabel", () => {
	test("labels each mode in English", () => {
		overwriteGetLocale(() => "en");

		expect(getMeteringModeLabel("tokens")).toBe("Tokens");
		expect(getMeteringModeLabel("requests")).toBe("Requests");
	});

	test("labels each mode in German", () => {
		overwriteGetLocale(() => "de");

		expect(getMeteringModeLabel("tokens")).toBe("Token");
		expect(getMeteringModeLabel("requests")).toBe("Anfragen");
	});
});

describe("getMeteringUnit", () => {
	test("follows the amount in English", () => {
		overwriteGetLocale(() => "en");

		expect(getMeteringUnit("requests", 1)).toBe("request");
		expect(getMeteringUnit("requests", 3)).toBe("requests");
		expect(getMeteringUnit("tokens", 1)).toBe("token");
		expect(getMeteringUnit("tokens", 1200)).toBe("tokens");
	});

	test("follows the amount in German", () => {
		overwriteGetLocale(() => "de");

		expect(getMeteringUnit("requests", 1)).toBe("Anfrage");
		expect(getMeteringUnit("requests", 3)).toBe("Anfragen");
		expect(getMeteringUnit("tokens", 1200)).toBe("Token");
	});
});
