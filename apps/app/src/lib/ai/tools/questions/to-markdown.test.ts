import { describe, expect, test } from "bun:test";
import {
	capitalsAnswers,
	capitalsQuiz,
	clarifyingAnswers,
	clarifyingRound,
} from "./fixtures";
import { askUserMarkdown } from "./to-markdown";

describe("askUserMarkdown", () => {
	test("lists each question with its answer", () => {
		expect(
			askUserMarkdown({
				input: clarifyingRound,
				output: clarifyingAnswers,
			}),
		).toBe(
			[
				"### About your bot",
				[
					"1. **Who is it for?**",
					"   Other: Alumni",
					"",
					"2. **Which features?**",
					"   Web search, Quizzes",
					"",
					"3. **What should it never do?**",
					"   _Not answered_",
					"",
					"4. **How formal?**",
					"   4",
				].join("\n"),
			].join("\n\n"),
		);
	});

	test("heads a quiz's sections", () => {
		expect(
			askUserMarkdown({
				input: capitalsQuiz,
				output: capitalsAnswers,
			}),
		).toBe(
			[
				"### Capitals",
				"#### Europe",
				"1. **Capital of France?**\n   Paris\n\n2. **Which are capitals?**\n   Berlin",
				"#### Asia",
				"3. **Capital of Japan?**\n   _Not answered_",
			].join("\n\n"),
		);
	});

	test("marks skipped questions without answers", () => {
		const skipped = askUserMarkdown({
			input: clarifyingRound,
			output: {
				status: "skipped",
			},
		});

		expect(skipped).toStartWith(
			"### About your bot\n\n_Skipped_\n\n1. **Who is it for?**\n\n2.",
		);
		expect(skipped).not.toContain("Not answered");
		expect(
			askUserMarkdown({
				input: clarifyingRound,
			}),
		).toBe(skipped);
	});

	test("reads nothing from an input that does not parse", () => {
		expect(
			askUserMarkdown({
				input: {
					mode: "regular",
				},
			}),
		).toBeUndefined();
	});
});
