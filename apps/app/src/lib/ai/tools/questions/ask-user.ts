import { tool } from "ai";
import { z } from "zod/v4";
import { toolInputSchema } from "@/lib/ai/tools/input-schema";
import type { NoToolContext } from "../assistant/procedure-tool";
import {
	type AnsweredQuestion,
	answeredQuestions,
	pointsOf,
} from "./questionnaire";

export const MAX_QUESTIONS = 5;
export const MAX_QUIZ_QUESTIONS = 20;
const MAX_OPTIONS = 10;
const MAX_SCALE_STEPS = 11;
const MAX_ANSWER_LENGTH = 4000;

const prompt = z
	.string()
	.trim()
	.min(1)
	.describe("The question, one or two sentences of plain text.");

const options = z
	.array(z.string().trim().min(1))
	.min(2)
	.max(MAX_OPTIONS)
	.describe("The options, a few words of plain text each.");

const quizFields = {
	section: z
		.string()
		.trim()
		.min(1)
		.optional()
		.describe(
			"Quiz only: the title of the section the question belongs to. Consecutive questions with the same section share a page.",
		),
	points: z
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe("Quiz only: what the question is worth. Defaults to 1."),
};

const questionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("single"),
		prompt,
		options,
		...quizFields,
	}),
	z.object({
		type: z.literal("multiple"),
		prompt,
		options,
		...quizFields,
	}),
	z.object({
		type: z.literal("text"),
		prompt,
		...quizFields,
	}),
	z
		.object({
			type: z.literal("scale"),
			prompt,
			min: z.int().min(0).max(100).describe("The lowest value."),
			max: z.int().min(1).max(100).describe("The highest value."),
			minLabel: z
				.string()
				.trim()
				.min(1)
				.optional()
				.describe("What the lowest value means, a word or two."),
			maxLabel: z
				.string()
				.trim()
				.min(1)
				.optional()
				.describe("What the highest value means, a word or two."),
			...quizFields,
		})
		.refine(
			({ min, max }) => max > min && max - min < MAX_SCALE_STEPS,
			`max must be above min, with at most ${MAX_SCALE_STEPS} values.`,
		),
]);

export type Question = z.infer<typeof questionSchema>;

export const askUserInputSchema = z
	.object({
		mode: z
			.enum([
				"regular",
				"quiz",
			])
			.describe(
				`regular: clarifying questions, up to ${MAX_QUESTIONS}, all optional; choice questions offer the user an Other field. quiz: up to ${MAX_QUIZ_QUESTIONS} questions to test the user, in titled sections, graded afterwards with showQuizResult; choice questions offer only their options.`,
			),
		title: z
			.string()
			.trim()
			.min(1)
			.optional()
			.describe("Short heading, plain text. A quiz's name."),
		questions: z.array(questionSchema).min(1).max(MAX_QUIZ_QUESTIONS),
	})
	.refine(
		({ mode, questions }) =>
			mode === "quiz" || questions.length <= MAX_QUESTIONS,
		{
			message: `A regular round asks at most ${MAX_QUESTIONS} questions.`,
			path: [
				"questions",
			],
		},
	);

export type AskUserInput = z.infer<typeof askUserInputSchema>;

const answerSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("choice"),
		choices: z
			.array(
				z
					.int()
					.min(0)
					.max(MAX_OPTIONS - 1),
			)
			.max(MAX_OPTIONS),
		other: z.string().trim().min(1).max(MAX_ANSWER_LENGTH).optional(),
	}),
	z.object({
		type: z.literal("text"),
		text: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
	}),
	z.object({
		type: z.literal("scale"),
		value: z.int(),
	}),
]);

export type Answer = z.infer<typeof answerSchema>;

export const askUserOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("answered"),
		/** One per question in order; null where the user gave none. */
		answers: z.array(answerSchema.nullable()).max(MAX_QUIZ_QUESTIONS),
	}),
	z.object({
		status: z.literal("skipped"),
	}),
]);

export type AskUserOutput = z.infer<typeof askUserOutputSchema>;

/** What the model reads for an answer: the option labels and Other text, the text, or the value. */
const modelAnswer = ({ question, answer }: AnsweredQuestion) => {
	if (!answer) {
		return null;
	}
	switch (answer.type) {
		case "choice":
			return {
				selected:
					question.type === "multiple" ? answer.labels : answer.labels[0],
				...(answer.other !== undefined && {
					other: answer.other,
				}),
			};
		case "text":
			return answer.text;
		case "scale":
			return answer.value;
	}
};

export const QUIZ_NEXT_STEP =
	"Grade every question with showQuizResult. A question without an answer is incorrect.";

export const SKIPPED_NEXT_STEP =
	"The user skipped the questions. Go on without their answers, and do not ask the same again unless the user asks.";

/** A client tool: the browser answers it through the questions in the conversation. */
export const askUserTool = tool<AskUserInput, AskUserOutput, NoToolContext>({
	description: [
		"Ask the user questions in the conversation and wait for their answers.",
		"Question types: single (one option), multiple (any options), text (free text) and scale (a number between min and max).",
		`regular mode asks up to ${MAX_QUESTIONS} clarifying questions; the user may answer some, all or none, and may skip.`,
		`quiz mode tests the user with up to ${MAX_QUIZ_QUESTIONS} questions in titled sections, each worth points. Never put the correct answers in the call: the user sees everything in it. After the user submits, grade every question with showQuizResult.`,
		"Returns the answers in question order, or status skipped. Do not repeat the questions or the answers in text.",
	].join(" "),
	inputSchema: toolInputSchema(askUserInputSchema),
	outputSchema: askUserOutputSchema,
	toModelOutput: ({ input, output }) => {
		if (output.status === "skipped") {
			return {
				type: "json",
				value: {
					status: output.status,
					next: SKIPPED_NEXT_STEP,
				},
			};
		}
		const answered = answeredQuestions(input, output.answers);
		if (input.mode === "regular") {
			return {
				type: "json",
				value: {
					status: output.status,
					answers: answered.map((entry) => ({
						question: entry.question.prompt,
						answer: modelAnswer(entry),
					})),
				},
			};
		}
		return {
			type: "json",
			value: {
				status: output.status,
				answers: answered.map((entry) => ({
					number: entry.number,
					...(entry.question.section !== undefined && {
						section: entry.question.section,
					}),
					question: entry.question.prompt,
					points: pointsOf(entry.question),
					answer: modelAnswer(entry),
				})),
				next: QUIZ_NEXT_STEP,
			},
		};
	},
});
