import { m } from "@/paraglide/messages";
import {
	type AskUserOutput,
	askUserInputSchema,
	askUserOutputSchema,
} from "./ask-user";
import {
	answeredQuestions,
	answerLine,
	numberedQuestions,
	quizSections,
} from "./questionnaire";

/** The questions with the given answers; without answers once skipped or never answered. */
export const askUserMarkdown = ({
	input,
	output,
}: {
	input: unknown;
	output?: AskUserOutput;
}): string | undefined => {
	const parsed = askUserInputSchema.safeParse(input);
	if (!parsed.success) {
		return undefined;
	}
	const answered = askUserOutputSchema.safeParse(output);
	const answers =
		answered.success && answered.data.status === "answered"
			? answered.data.answers
			: undefined;
	const entries = answers
		? answeredQuestions(parsed.data, answers)
		: numberedQuestions(parsed.data).map((entry) => ({
				...entry,
				answer: undefined,
			}));
	const questionBlock = ({ number, question, answer }: (typeof entries)[0]) =>
		[
			`${number}. **${question.prompt}**`,
			answers &&
				`   ${answer ? answerLine(answer, m.questions_other_label()) : `_${m.questions_not_answered()}_`}`,
		]
			.filter(Boolean)
			.join("\n");
	const pages =
		parsed.data.mode === "quiz"
			? quizSections(entries)
			: [
					{
						title: undefined,
						questions: entries,
					},
				];

	return [
		parsed.data.title && `### ${parsed.data.title}`,
		!answers && `_${m.questions_skipped()}_`,
		...pages.flatMap((page) => [
			page.title && `#### ${page.title}`,
			page.questions.map(questionBlock).join("\n\n"),
		]),
	]
		.filter(Boolean)
		.join("\n\n");
};
