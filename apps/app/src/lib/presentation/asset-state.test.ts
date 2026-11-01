import { describe, expect, test } from "bun:test";
import { canPrepareAgain } from "./asset-state";

describe("canPrepareAgain", () => {
	test("allows an image the utility model could not read, not another unsupported file", () => {
		expect(canPrepareAgain("unsupported", "png")).toBe(true);
		expect(canPrepareAgain("unsupported", "docx")).toBe(false);
	});

	test("follows whether a person's retry helps otherwise", () => {
		expect(canPrepareAgain("quota", "pdf")).toBe(true);
		expect(canPrepareAgain("empty", "png")).toBe(false);
	});
});
