import { describe, expect, test } from "bun:test";
import { literalSearch } from "./literal-search";

describe("literalSearch", () => {
	test("wraps a plain term in wildcards", () => {
		expect(literalSearch("alice")).toBe("%alice%");
	});

	test("escapes a backslash", () => {
		expect(literalSearch("a\\b")).toBe("%a\\\\b%");
	});

	test("escapes a percent sign", () => {
		expect(literalSearch("100%")).toBe("%100\\%%");
	});

	test("escapes an underscore", () => {
		expect(literalSearch("a_b")).toBe("%a\\_b%");
	});
});
