import { describe, expect, test } from "bun:test";
import {
	capitalsAnswers,
	capitalsQuiz,
	clarifyingAnswers,
	clarifyingRound,
} from "./fixtures";
import { gradeQuiz, latestAnsweredQuiz, type QuizGrading } from "./quiz-result";

const quiz = {
	input: capitalsQuiz,
	output: capitalsAnswers,
};

const grading: QuizGrading = {
	results: [
		{
			question: 1,
			verdict: "correct",
			expected: "Paris",
			explanation: "Not shown for a correct answer.",
		},
		{
			question: 2,
			verdict: "partly_correct",
			earned: 1,
			expected: "Berlin and Vienna",
			explanation: "Vienna is a capital too.",
		},
		{
			question: 3,
			verdict: "incorrect",
			expected: "Tokyo",
		},
	],
};

const problemOf = (results: QuizGrading["results"]) => {
	const graded = gradeQuiz(quiz, {
		results,
	});
	return graded.ok ? undefined : graded.message;
};

describe("gradeQuiz", () => {
	test("totals the points overall and per section", () => {
		expect(gradeQuiz(quiz, grading)).toEqual({
			ok: true,
			result: {
				title: "Capitals",
				earned: 2,
				points: 4,
				sections: [
					{
						title: "Europe",
						earned: 2,
						points: 3,
						questions: [
							{
								number: 1,
								prompt: "Capital of France?",
								answer: "Paris",
								verdict: "correct",
								earned: 1,
								points: 1,
							},
							{
								number: 2,
								prompt: "Which are capitals?",
								answer: "Berlin",
								verdict: "partly_correct",
								earned: 1,
								points: 2,
								expected: "Berlin and Vienna",
								explanation: "Vienna is a capital too.",
							},
						],
					},
					{
						title: "Asia",
						earned: 0,
						points: 1,
						questions: [
							{
								number: 3,
								prompt: "Capital of Japan?",
								answer: null,
								verdict: "incorrect",
								earned: 0,
								points: 1,
								expected: "Tokyo",
							},
						],
					},
				],
			},
		});
	});

	test("counts half points", () => {
		const graded = gradeQuiz(quiz, {
			results: grading.results.map((result) =>
				result.question === 2
					? {
							...result,
							earned: 1.5,
						}
					: result,
			),
		});

		expect(graded.ok && graded.result.earned).toBe(2.5);
	});

	test("refuses earned points that do not fit the verdict", () => {
		const withSecond = (second: QuizGrading["results"][number]) =>
			problemOf([
				grading.results[0],
				second,
				grading.results[2],
			]);

		expect(
			withSecond({
				question: 2,
				verdict: "partly_correct",
				earned: 3,
			}),
		).toBe(
			"QUIZ_GRADING_INVALID: question 2: partly_correct needs earned between 0 and 2.",
		);
		expect(
			withSecond({
				question: 2,
				verdict: "partly_correct",
			}),
		).toContain("partly_correct needs earned");
		expect(
			withSecond({
				question: 2,
				verdict: "correct",
				earned: 1,
			}),
		).toContain("correct earns all 2 points");
		expect(
			withSecond({
				question: 2,
				verdict: "incorrect",
				earned: 1,
			}),
		).toContain("incorrect earns 0 points");
	});

	test("refuses credit for a question left blank", () => {
		expect(
			problemOf([
				grading.results[0],
				grading.results[1],
				{
					question: 3,
					verdict: "correct",
				},
			]),
		).toBe(
			"QUIZ_GRADING_INVALID: question 3 has no answer, so it is incorrect.",
		);
	});

	test("refuses a grading that misses, repeats or invents questions", () => {
		expect(
			problemOf([
				grading.results[0],
				grading.results[0],
				{
					question: 4,
					verdict: "incorrect",
				},
			]),
		).toBe(
			"QUIZ_GRADING_INVALID: question 1 is graded twice; question 4 does not exist; the quiz has 3; question 2 is not graded; question 3 is not graded.",
		);
	});
});

const askUserPart = (input: unknown, output?: unknown) => ({
	type: "tool-askUser",
	state: output === undefined ? "input-available" : "output-available",
	input,
	output,
});

describe("latestAnsweredQuiz", () => {
	test("finds the latest quiz, past newer regular rounds", () => {
		const later = {
			...capitalsQuiz,
			title: "Later",
		};

		expect(
			latestAnsweredQuiz([
				{
					parts: [
						askUserPart(capitalsQuiz, capitalsAnswers),
					],
				},
				{
					parts: [
						askUserPart(later, capitalsAnswers),
						askUserPart(clarifyingRound, clarifyingAnswers),
					],
				},
			])?.input.title,
		).toBe("Later");
	});

	test("finds nothing when the latest quiz was skipped or is unanswered", () => {
		expect(
			latestAnsweredQuiz([
				{
					parts: [
						askUserPart(capitalsQuiz, capitalsAnswers),
						askUserPart(capitalsQuiz, {
							status: "skipped",
						}),
					],
				},
			]),
		).toBeUndefined();
		expect(
			latestAnsweredQuiz([
				{
					parts: [
						askUserPart(capitalsQuiz),
					],
				},
			]),
		).toBeUndefined();
	});
});
