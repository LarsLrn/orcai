import { describe, expect, test } from "bun:test";
import { formatAssetTitle } from "./asset-title";

describe("formatAssetTitle", () => {
	test("strips a chain of file extensions", () => {
		expect(formatAssetTitle("Workshop Tutoring Systems.pptx.pdf")).toBe(
			"Workshop Tutoring Systems",
		);
	});

	test("keeps a date that looks like an extension", () => {
		expect(
			formatAssetTitle("Workshop Tutoring Systems 25.03.2026.pptx.pdf"),
		).toBe("Workshop Tutoring Systems 25.03.2026");
	});

	test("keeps a title without an extension", () => {
		expect(formatAssetTitle("Annual report 2025")).toBe("Annual report 2025");
	});

	test("falls back when the title is missing", () => {
		expect(formatAssetTitle(undefined)).toBe("Source");
		expect(formatAssetTitle("  ")).toBe("Source");
	});
});
