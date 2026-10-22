import {
	type QuizResult,
	quizResultSchema,
} from "@/lib/ai/tools/questions/quiz-result";

/** The graded quiz once its call ran; nothing before, while it is graded. */
export const readQuizResult = (
	_input: unknown,
	output?: unknown,
): {
	result: QuizResult | undefined;
} => {
	const parsed = quizResultSchema.safeParse(output);
	return {
		result: parsed.success ? parsed.data : undefined,
	};
};

export type QuizResultView = ReturnType<typeof readQuizResult>;
