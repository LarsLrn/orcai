import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AskUserInput } from "@/lib/ai/tools/questions/ask-user";
import {
	numberedQuestions,
	pointsOf,
	quizSections,
} from "@/lib/ai/tools/questions/questionnaire";
import { m } from "@/paraglide/messages";
import { type Draft, draftAnswers, emptyDraft, pointsVary } from "./draft";
import { QuestionField } from "./question-field";
import { QuestionsCard } from "./questions-card";

/** A quiz, one section per page; every question counts, so the last page says how many are blank. */
export const QuizPager = ({
	input,
	onSubmit,
	onSkip,
}: {
	input: AskUserInput;
	onSubmit: (drafts: Draft[]) => void;
	onSkip: () => void;
}) => {
	const id = useId();
	const sections = quizSections(numberedQuestions(input));
	const showPoints = pointsVary(input);
	const [drafts, setDrafts] = useState<Draft[]>(() =>
		input.questions.map(emptyDraft),
	);
	const [page, setPage] = useState(0);
	const section = sections[page];
	const last = page === sections.length - 1;
	const blank = draftAnswers(input, drafts).filter(
		(answer) => answer === null,
	).length;

	const setDraft = (index: number) => (draft: Draft) =>
		setDrafts((current) =>
			current.map((existing, at) => (at === index ? draft : existing)),
		);

	return (
		<QuestionsCard
			title={input.title}
			progress={
				sections.length > 1
					? m.questions_section_progress({
							page: page + 1,
							count: sections.length,
						})
					: undefined
			}
			footer={
				<>
					<Button variant="ghost" size="sm" onClick={onSkip}>
						{m.questions_skip_quiz_action()}
					</Button>
					<div className="flex items-center gap-2">
						{last && blank > 0 && (
							<span className="text-muted-foreground text-xs">
								{m.questions_quiz_blank({
									count: blank,
								})}
							</span>
						)}
						{page > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPage((current) => current - 1)}
							>
								{m.questions_back_action()}
							</Button>
						)}
						{last ? (
							<Button size="sm" onClick={() => onSubmit(drafts)}>
								{m.questions_submit_quiz_action()}
							</Button>
						) : (
							<Button
								size="sm"
								onClick={() => setPage((current) => current + 1)}
							>
								{m.questions_next_action()}
							</Button>
						)}
					</div>
				</>
			}
		>
			<div key={page} className="flex flex-col gap-5">
				{section.title && (
					<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{section.title}
					</h4>
				)}
				{section.questions.map(({ number, question }) => {
					const promptId = `${id}-${number}`;
					return (
						<div key={number} className="flex flex-col gap-3">
							<p id={promptId} className="flex gap-2 font-medium text-sm">
								<span className="flex-1">
									{number}. {question.prompt}
								</span>
								{showPoints && (
									<span className="shrink-0 font-normal text-muted-foreground text-xs">
										{m.questions_points({
											count: pointsOf(question),
										})}
									</span>
								)}
							</p>
							<QuestionField
								question={question}
								withOther={false}
								draft={drafts[number - 1]}
								onChange={setDraft(number - 1)}
								labelledBy={promptId}
							/>
						</div>
					);
				})}
			</div>
		</QuestionsCard>
	);
};
