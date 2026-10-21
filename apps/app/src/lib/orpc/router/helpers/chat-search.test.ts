import { describe, expect, test } from "bun:test";
import { prefixTsQuery, snippetOf } from "./chat-search";

describe("prefixTsQuery", () => {
	test("requires every term and treats the last as a prefix", () => {
		expect(prefixTsQuery("  quarterly   budg ")).toBe("'quarterly' & 'budg':*");
	});

	test("keeps query operators and quotes as text", () => {
		expect(prefixTsQuery("it's !a|b \\x")).toBe("'it''s' & '!a|b' & '\\\\x':*");
	});

	test("has nothing to search in blank input", () => {
		expect(prefixTsQuery(" \t ")).toBeUndefined();
	});
});

describe("snippetOf", () => {
	test("splits a headline into plain and highlighted segments", () => {
		expect(snippetOf("Start \u0002budget\u0003 and \u0002plan\u0003")).toEqual([
			{
				text: "Start ",
				highlighted: false,
			},
			{
				text: "budget",
				highlighted: true,
			},
			{
				text: " and ",
				highlighted: false,
			},
			{
				text: "plan",
				highlighted: true,
			},
		]);
	});

	test("is one plain segment without matches", () => {
		expect(snippetOf("no match")).toEqual([
			{
				text: "no match",
				highlighted: false,
			},
		]);
	});
});
