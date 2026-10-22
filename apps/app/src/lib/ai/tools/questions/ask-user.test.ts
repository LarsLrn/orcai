import { describe, expect, test } from "bun:test";
import {
	askUserInputSchema,
	askUserOutputSchema,
	askUserTool,
	QUIZ_NEXT_STEP,
	SKIPPED_NEXT_STEP,
} from "./ask-user";
import {
	capitalsAnswers,
	capitalsQuiz,
	clarifyingAnswers,
	clarifyingRound,
} from "./fixtures";

const modelOutput = (
	input: Parameters<NonNullable<typeof askUserTool.toModelOutput>>[0]["input"],
	output: Parameters<
		NonNullable<typeof askUserTool.toModelOutput>
	>[0]["output"],
) =>
	askUserTool.toModelOutput?.({
		toolCallId: "ask-1",
		input,
		output,
	});

const textQuestion = (prompt: string) => ({
	type: "text",
	prompt,
});

describe("askUser input", () => {
	test("a regular round asks at most five questions, a quiz twenty", () => {
		const six = Array.from(
			{
				length: 6,
			},
			(_, index) => textQuestion(`Question ${index}`),
		);

		expect(
			askUserInputSchema.safeParse({
				mode: "regular",
				questions: six,
			}).success,
		).toBe(false);
		expect(
			askUserInputSchema.safeParse({
				mode: "quiz",
				questions: six,
			}).success,
		).toBe(true);
		expect(
			askUserInputSchema.safeParse({
				mode: "quiz",
				questions: Array.from(
					{
						length: 21,
					},
					(_, index) => textQuestion(`Question ${index}`),
				),
			}).success,
		).toBe(false);
	});

	test("a scale needs max above min and at most eleven values", () => {
		const scale = (min: number, max: number) =>
			askUserInputSchema.safeParse({
				mode: "regular",
				questions: [
					{
						type: "scale",
						prompt: "How much?",
						min,
						max,
					},
				],
			}).success;

		expect(scale(1, 5)).toBe(true);
		expect(scale(0, 10)).toBe(true);
		expect(scale(0, 11)).toBe(false);
		expect(scale(3, 3)).toBe(false);
	});

	test("a choice question needs two options", () => {
		expect(
			askUserInputSchema.safeParse({
				mode: "regular",
				questions: [
					{
						type: "single",
						prompt: "Yes?",
						options: [
							"Yes",
						],
					},
				],
			}).success,
		).toBe(false);
	});
});

describe("askUser output", () => {
	test("answers line up with the questions, null where unanswered", () => {
		expect(askUserOutputSchema.parse(clarifyingAnswers)).toEqual(
			clarifyingAnswers,
		);
	});

	test("a blank text answer is no answer", () => {
		expect(
			askUserOutputSchema.safeParse({
				status: "answered",
				answers: [
					{
						type: "text",
						text: "  ",
					},
				],
			}).success,
		).toBe(false);
	});
});

describe("askUser model output", () => {
	test("names each question with the answer in its labels", async () => {
		expect(await modelOutput(clarifyingRound, clarifyingAnswers)).toEqual({
			type: "json",
			value: {
				status: "answered",
				answers: [
					{
						question: "Who is it for?",
						answer: {
							other: "Alumni",
						},
					},
					{
						question: "Which features?",
						answer: {
							selected: [
								"Web search",
								"Quizzes",
							],
						},
					},
					{
						question: "What should it never do?",
						answer: null,
					},
					{
						question: "How formal?",
						answer: 4,
					},
				],
			},
		});
	});

	test("numbers a quiz's questions with their points and asks for grading", async () => {
		expect(await modelOutput(capitalsQuiz, capitalsAnswers)).toEqual({
			type: "json",
			value: {
				status: "answered",
				answers: [
					{
						number: 1,
						section: "Europe",
						question: "Capital of France?",
						points: 1,
						answer: {
							selected: "Paris",
						},
					},
					{
						number: 2,
						section: "Europe",
						question: "Which are capitals?",
						points: 2,
						answer: {
							selected: [
								"Berlin",
							],
						},
					},
					{
						number: 3,
						section: "Asia",
						question: "Capital of Japan?",
						points: 1,
						answer: null,
					},
				],
				next: QUIZ_NEXT_STEP,
			},
		});
	});

	test("says the user skipped, and not to ask again", async () => {
		expect(
			await modelOutput(clarifyingRound, {
				status: "skipped",
			}),
		).toEqual({
			type: "json",
			value: {
				status: "skipped",
				next: SKIPPED_NEXT_STEP,
			},
		});
	});
});
