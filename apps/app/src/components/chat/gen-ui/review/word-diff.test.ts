import { describe, expect, test } from "bun:test";
import {
	retainedShare,
	wordDiff,
} from "@/components/chat/gen-ui/review/word-diff";

describe("wordDiff", () => {
	test("marks removed and added words, keeping whitespace", () => {
		expect(wordDiff("The Power of Feedback", "The power of feedback")).toEqual([
			{
				text: "The",
				kind: "same",
			},
			{
				text: " ",
				kind: "same",
			},
			{
				text: "Power",
				kind: "del",
			},
			{
				text: "power",
				kind: "add",
			},
			{
				text: " ",
				kind: "same",
			},
			{
				text: "of",
				kind: "same",
			},
			{
				text: " ",
				kind: "same",
			},
			{
				text: "Feedback",
				kind: "del",
			},
			{
				text: "feedback",
				kind: "add",
			},
		]);
	});

	test("reads back to the original and to the revision", () => {
		const before = "Hattie, J. and Timperley, H. (2007).";
		const after = "Hattie, J., & Timperley, H. (2007). New.";
		const tokens = wordDiff(before, after);
		const join = (kind: "add" | "del") =>
			tokens
				.filter((token) => token.kind !== kind)
				.map((token) => token.text)
				.join("");

		expect(join("add")).toBe(before);
		expect(join("del")).toBe(after);
	});
});

describe("retainedShare", () => {
	test("is the share of original words kept", () => {
		expect(
			retainedShare(wordDiff("one two three four", "one two five six")),
		).toBe(0.5);
		expect(retainedShare(wordDiff("same words", "same words"))).toBe(1);
	});

	test("drops below half for a rewrite", () => {
		expect(
			retainedShare(
				wordDiff(
					"Students will understand the main qualitative research methods.",
					"Compare the strengths and limitations of three qualitative research methods for a given research question.",
				),
			),
		).toBeLessThan(0.5);
	});
});
