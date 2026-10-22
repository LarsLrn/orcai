import type {
	AskUserInput,
	AskUserOutput,
} from "@/lib/ai/tools/questions/ask-user";
import {
	type AnsweredQuestion,
	answeredQuestions,
	answerLine,
	numberedQuestions,
	quizSections,
} from "@/lib/ai/tools/questions/questionnaire";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The questions as asked, read-only, with the answers once the user gave them. */
export const AnsweredQuestions = ({
	input,
	output,
}: {
	input: AskUserInput;
	output: AskUserOutput | undefined;
}) => {
	const answers = output?.status === "answered" ? output.answers : undefined;
	const entries: AnsweredQuestion[] = answers
		? answeredQuestions(input, answers)
		: numberedQuestions(input).map((entry) => ({
				...entry,
				answer: undefined,
			}));
	const pages =
		input.mode === "quiz"
			? quizSections(entries)
			: [
					{
						title: undefined,
						questions: entries,
					},
				];

	return (
		<div className="flex flex-col gap-4">
			{pages.map((page, index) => (
				<div key={index} className="flex flex-col gap-2">
					{page.title && (
						<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							{page.title}
						</h4>
					)}
					<ol className="flex flex-col gap-2">
						{page.questions.map(({ number, question, answer }) => (
							<li key={number} className="flex flex-col gap-0.5 text-sm">
								<span className="font-medium">
									{number}. {question.prompt}
								</span>
								{answers && (
									<span
										className={cn("text-muted-foreground", !answer && "italic")}
									>
										{answer
											? answerLine(answer, m.questions_other_label())
											: m.questions_not_answered()}
									</span>
								)}
							</li>
						))}
					</ol>
				</div>
			))}
		</div>
	);
};
