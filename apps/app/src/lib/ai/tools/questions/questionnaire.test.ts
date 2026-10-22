import { describe, expect, test } from "bun:test";
import { capitalsQuiz, clarifyingRound } from "./fixtures";
import {
	answeredQuestions,
	answerLine,
	numberedQuestions,
	quizSections,
} from "./questionnaire";

const answerTo = (
	input: Parameters<typeof answeredQuestions>[0],
	index: number,
	answer: Parameters<typeof answeredQuestions>[1][number],
) =>
	answeredQuestions(
		input,
		input.questions.map((_, at) => (at === index ? answer : null)),
	)[index].answer;

describe("answeredQuestions", () => {
	test("reads chosen options as labels in option order, Other after", () => {
		const answer = answerTo(clarifyingRound, 1, {
			type: "choice",
			choices: [
				2,
				0,
				2,
			],
			other: "Citations",
		});

		expect(answer).toEqual({
			type: "choice",
			choices: [
				0,
				2,
			],
			labels: [
				"Web search",
				"Quizzes",
			],
			other: "Citations",
		});
		expect(answer && answerLine(answer)).toBe(
			"Web search, Quizzes, Other: Citations",
		);
	});

	test("drops answers that do not fit their question", () => {
		expect(
			answerTo(clarifyingRound, 0, {
				type: "choice",
				choices: [
					5,
				],
			}),
		).toBeUndefined();
		expect(
			answerTo(clarifyingRound, 0, {
				type: "choice",
				choices: [
					0,
					1,
				],
			}),
		).toBeUndefined();
		expect(
			answerTo(clarifyingRound, 0, {
				type: "text",
				text: "Students",
			}),
		).toBeUndefined();
		expect(
			answerTo(clarifyingRound, 3, {
				type: "scale",
				value: 6,
			}),
		).toBeUndefined();
	});

	test("a quiz has no Other", () => {
		expect(
			answerTo(capitalsQuiz, 0, {
				type: "choice",
				choices: [],
				other: "Marseille",
			}),
		).toBeUndefined();
	});
});

describe("quizSections", () => {
	test("groups consecutive questions of a section, numbered across sections", () => {
		expect(
			quizSections(numberedQuestions(capitalsQuiz)).map((section) => ({
				title: section.title,
				numbers: section.questions.map(({ number }) => number),
			})),
		).toEqual([
			{
				title: "Europe",
				numbers: [
					1,
					2,
				],
			},
			{
				title: "Asia",
				numbers: [
					3,
				],
			},
		]);
	});
});
