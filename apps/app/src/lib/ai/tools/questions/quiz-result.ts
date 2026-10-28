import { z } from "zod/v4";
import {
	type AskUserInput,
	type AskUserOutput,
	askUserInputSchema,
	askUserOutputSchema,
	MAX_QUIZ_QUESTIONS,
} from "./ask-user";
import {
	answeredQuestions,
	answerLine,
	pointsOf,
	quizSections,
} from "./questionnaire";

const verdictSchema = z.enum([
	"correct",
	"partly_correct",
	"incorrect",
]);

export type Verdict = z.infer<typeof verdictSchema>;

export const quizGradingSchema = z.strictObject({
	results: z
		.array(
			z.strictObject({
				question: z
					.int()
					.min(1)
					.describe(
						"The question's number, counting from 1 across sections in the order asked.",
					),
				verdict: verdictSchema,
				earned: z
					.number()
					.min(0)
					.multipleOf(0.5)
					.optional()
					.describe(
						"Points earned, in half-point steps. Needed for partly_correct only: correct earns all of the question's points, incorrect none.",
					),
				expected: z
					.string()
					.trim()
					.min(1)
					.optional()
					.describe(
						"Unless correct: the right answer; for free text, its key points. Markdown, short.",
					),
				explanation: z
					.string()
					.trim()
					.min(1)
					.optional()
					.describe(
						"Unless correct: why the given answer is wrong and the right one is right, or which items a multiple-choice answer missed. Markdown, one to three sentences.",
					),
			}),
		)
		.min(1)
		.max(MAX_QUIZ_QUESTIONS)
		.describe("One result per question of the quiz."),
});

export type QuizGrading = z.infer<typeof quizGradingSchema>;

export const quizResultSchema = z.object({
	title: z.string().optional(),
	earned: z.number(),
	points: z.number(),
	sections: z.array(
		z.object({
			title: z.string().optional(),
			earned: z.number(),
			points: z.number(),
			questions: z.array(
				z.object({
					number: z.int(),
					prompt: z.string(),
					/** The given answer as one line; null when there was none. */
					answer: z.string().nullable(),
					verdict: verdictSchema,
					earned: z.number(),
					points: z.number(),
					expected: z.string().optional(),
					explanation: z.string().optional(),
				}),
			),
		}),
	),
});

export type QuizResult = z.infer<typeof quizResultSchema>;

/** A quiz and what the user answered. */
export interface AnsweredQuiz {
	input: AskUserInput;
	output: Extract<
		AskUserOutput,
		{
			status: "answered";
		}
	>;
}

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

/** Correct earns every point, incorrect none, partly correct some in between. */
const earnedOf = (
	verdict: Verdict,
	earned: number | undefined,
	points: number,
): number | string => {
	switch (verdict) {
		case "correct":
			return earned === undefined || earned === points
				? points
				: `correct earns all ${points} points`;
		case "incorrect":
			return earned === undefined || earned === 0
				? 0
				: "incorrect earns 0 points";
		case "partly_correct":
			return earned !== undefined && earned > 0 && earned < points
				? earned
				: `partly_correct needs earned between 0 and ${points}`;
	}
};

/**
 * The graded quiz with its totals, overall and per section, or why the
 * grading does not fit the quiz: every question graded once, earned points
 * that fit the verdict, and no credit for a question left blank.
 */
export const gradeQuiz = (
	{ input, output }: AnsweredQuiz,
	{ results }: QuizGrading,
):
	| {
			ok: true;
			result: QuizResult;
	  }
	| {
			ok: false;
			message: string;
	  } => {
	const answered = answeredQuestions(input, output.answers);
	const byNumber = new Map<number, QuizGrading["results"][number]>();
	const problems: string[] = [];

	for (const result of results) {
		if (result.question > answered.length) {
			problems.push(
				`question ${result.question} does not exist; the quiz has ${answered.length}`,
			);
		} else if (byNumber.has(result.question)) {
			problems.push(`question ${result.question} is graded twice`);
		} else {
			byNumber.set(result.question, result);
		}
	}

	const graded = answered.flatMap((entry) => {
		const result = byNumber.get(entry.number);
		if (!result) {
			problems.push(`question ${entry.number} is not graded`);
			return [];
		}
		const points = pointsOf(entry.question);
		const earned = earnedOf(result.verdict, result.earned, points);
		if (typeof earned === "string") {
			problems.push(`question ${entry.number}: ${earned}`);
			return [];
		}
		if (!entry.answer && result.verdict !== "incorrect") {
			problems.push(
				`question ${entry.number} has no answer, so it is incorrect`,
			);
			return [];
		}
		const fullyCorrect = result.verdict === "correct";
		return [
			{
				entry,
				question: {
					number: entry.number,
					prompt: entry.question.prompt,
					answer: entry.answer ? answerLine(entry.answer) : null,
					verdict: result.verdict,
					earned,
					points,
					...(!fullyCorrect &&
						result.expected !== undefined && {
							expected: result.expected,
						}),
					...(!fullyCorrect &&
						result.explanation !== undefined && {
							explanation: result.explanation,
						}),
				},
			},
		];
	});

	if (problems.length > 0) {
		return {
			ok: false,
			message: `QUIZ_GRADING_INVALID: ${problems.join("; ")}.`,
		};
	}

	const sections = quizSections(graded.map((item) => item.entry)).map(
		(section) => {
			const questions = section.questions.map(
				(entry) => graded[entry.number - 1].question,
			);
			return {
				...(section.title !== undefined && {
					title: section.title,
				}),
				earned: sum(questions.map((question) => question.earned)),
				points: sum(questions.map((question) => question.points)),
				questions,
			};
		},
	);

	return {
		ok: true,
		result: {
			...(input.title !== undefined && {
				title: input.title,
			}),
			earned: sum(sections.map((section) => section.earned)),
			points: sum(sections.map((section) => section.points)),
			sections,
		},
	};
};

/** A stored message, typed structurally so callers pass their own message type. */
export interface QuizHistoryMessage {
	parts: readonly {
		type: string;
		state?: string;
		input?: unknown;
		output?: unknown;
	}[];
}

/** The conversation's latest quiz, if the user answered it. */
export const latestAnsweredQuiz = (
	history: readonly QuizHistoryMessage[],
): AnsweredQuiz | undefined => {
	const quiz = history
		.flatMap((message) => message.parts)
		.filter((part) => part.type === "tool-askUser")
		.map((part) => ({
			part,
			input: askUserInputSchema.safeParse(part.input),
		}))
		.reverse()
		.find(({ input }) => input.success && input.data.mode === "quiz");
	if (!quiz?.input.success || quiz.part.state !== "output-available") {
		return undefined;
	}
	const output = askUserOutputSchema.safeParse(quiz.part.output);
	return output.success && output.data.status === "answered"
		? {
				input: quiz.input.data,
				output: output.data,
			}
		: undefined;
};

export const showQuizResultDescription =
	"Show the graded quiz in your answer, after the user submitted a quiz from askUser. Grade every question once: verdict correct, partly_correct (with the points earned) or incorrect. A question without an answer is incorrect. Unless correct, give the expected answer and a short explanation. Totals are computed for you; it returns the score. Do not repeat the results in text: a short remark on the score is enough.";
