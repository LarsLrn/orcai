import { describe, expect, test } from "bun:test";
import { citedRefs, citeTags, replaceCiteTags } from "./cite-tag";

describe("citeTags", () => {
	test("reads the ref with or without quotes", () => {
		expect(
			citeTags('<cite ref=kgol9ts>a</cite> and <cite ref="w2jpxug">b</cite>'),
		).toEqual([
			{
				tag: "<cite ref=kgol9ts>a</cite>",
				ref: "kgol9ts",
				attributes: [
					"ref",
				],
				text: "a",
			},
			{
				tag: '<cite ref="w2jpxug">b</cite>',
				ref: "w2jpxug",
				attributes: [
					"ref",
				],
				text: "b",
			},
		]);
	});

	test("names every attribute and leaves an unclosed tag without text", () => {
		expect(
			citeTags('<cite chunk="k000001" page=4>a <cite ref=kgol9ts>b</cite>'),
		).toEqual([
			{
				tag: '<cite chunk="k000001" page=4>',
				ref: undefined,
				attributes: [
					"chunk",
					"page",
				],
				text: undefined,
			},
			{
				tag: "<cite ref=kgol9ts>b</cite>",
				ref: "kgol9ts",
				attributes: [
					"ref",
				],
				text: "b",
			},
		]);
	});
});

describe("citedRefs", () => {
	test("counts a ref once its opening tag is written", () => {
		expect(citedRefs("<cite ref=kgol9ts>still streaming")).toEqual(
			new Set([
				"kgol9ts",
			]),
		);
		expect(citedRefs("<cite ref=kgol9")).toEqual(new Set());
	});
});

describe("replaceCiteTags", () => {
	test("replaces closed tags and keeps the rest of the text", () => {
		expect(
			replaceCiteTags(
				"A <cite ref=kgol9ts>b</cite> c <cite ref=w2jpxug>d",
				({ ref, text }) => `${text} [${ref}]`,
			),
		).toBe("A b [kgol9ts] c <cite ref=w2jpxug>d");
	});
});
