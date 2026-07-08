import { describe, expect, test } from "bun:test";
import { countTokens } from "../src/count-tokens";

describe("countTokens", () => {
	test("counts tokens for an empty string", () => {
		expect(countTokens("")).toBe(0);
	});

	test("counts tokens for a simple word", () => {
		const tokens = countTokens("hello");
		expect(tokens).toBeGreaterThan(0);
	});

	test("counts more tokens for longer text", () => {
		const short = countTokens("hello");
		const long = countTokens("hello world, this is a longer piece of text");

		expect(long).toBeGreaterThan(short);
	});

	test("counts tokens for unicode text", () => {
		const tokens = countTokens("héllo 世界 🌍");
		expect(tokens).toBeGreaterThan(0);
	});
});
