import { describe, expect, test } from "bun:test";
import { canReprocess } from "./document-state";

describe("canReprocess", () => {
	test("allows an image the utility model could not read, not another unsupported file", () => {
		expect(canReprocess("unsupported", "png")).toBe(true);
		expect(canReprocess("unsupported", "docx")).toBe(false);
	});

	test("follows whether a person's retry helps otherwise", () => {
		expect(canReprocess("quota", "pdf")).toBe(true);
		expect(canReprocess("empty", "png")).toBe(false);
	});
});
