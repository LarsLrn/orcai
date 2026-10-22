import { tool } from "ai";
import { toolInputSchema } from "@/lib/ai/tools/input-schema";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import { askUserTool } from "./ask-user";
import {
	gradeQuiz,
	latestAnsweredQuiz,
	type QuizHistoryMessage,
	type QuizResult,
	quizGradingSchema,
	quizResultSchema,
	showQuizResultDescription,
} from "./quiz-result";

/** Grades the conversation's latest answered quiz; a grading that does not fit fails for the model to fix. */
const showQuizResultTool = ({
	history,
}: {
	history: readonly QuizHistoryMessage[];
}) =>
	tool({
		description: showQuizResultDescription,
		inputSchema: toolInputSchema(quizGradingSchema),
		outputSchema: quizResultSchema,
		execute: (grading): QuizResult => {
			const quiz = latestAnsweredQuiz(history);
			if (!quiz) {
				throw new AssistantToolError(
					"QUIZ_NOT_ANSWERED: There is no quiz the user submitted answers to.",
				);
			}
			const graded = gradeQuiz(quiz, grading);
			if (!graded.ok) {
				throw new AssistantToolError(graded.message);
			}
			return graded.result;
		},
		toModelOutput: ({ output }) => ({
			type: "json",
			value: {
				shown: true,
				earned: output.earned,
				points: output.points,
				sections: output.sections.map(({ title, earned, points }) => ({
					title,
					earned,
					points,
				})),
			},
		}),
	});

/** The questions feature's tools: askUser, and showQuizResult over the stored conversation. */
export const buildQuestionTools = ({
	history,
}: {
	history: readonly QuizHistoryMessage[];
}) => ({
	askUser: askUserTool,
	showQuizResult: showQuizResultTool({
		history,
	}),
});

export type QuestionTools = ReturnType<typeof buildQuestionTools>;
