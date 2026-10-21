import { describe, expect, test } from "bun:test";
import { sanitizeGeneratedChatTitle } from "./chat-title";

describe("sanitizeGeneratedChatTitle", () => {
	test("trims quotes and whitespace", () => {
		expect(sanitizeGeneratedChatTitle('  "Plan  a trip"\n')).toBe(
			"Plan a trip",
		);
	});

	test("returns null for an empty title", () => {
		expect(sanitizeGeneratedChatTitle(' "" ')).toBeNull();
	});

	test("strips LaTeX delimiters and keeps the math", () => {
		expect(
			sanitizeGeneratedChatTitle("Solving \\(x^2 = 4\\) and \\[y\\]"),
		).toBe("Solving x^2 = 4 and y");
	});
});
