import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AskUserInput } from "@/lib/ai/tools/questions/ask-user";
import {
	answeredQuestions,
	answerLine,
} from "@/lib/ai/tools/questions/questionnaire";
import { m } from "@/paraglide/messages";
import { type Draft, draftAnswers, emptyDraft } from "./draft";
import { QuestionField } from "./question-field";
import { QuestionsCard } from "./questions-card";

/**
 * A regular round, one question per step and a review after the last. Picking
 * a single choice moves on, and only the review submits.
 */
export const QuestionStepper = ({
	input,
	onSubmit,
	onSkip,
}: {
	input: AskUserInput;
	onSubmit: (drafts: Draft[]) => void;
	onSkip: () => void;
}) => {
	const promptId = useId();
	const { questions } = input;
	const [drafts, setDrafts] = useState<Draft[]>(() =>
		questions.map(emptyDraft),
	);
	const [step, setStep] = useState(0);
	const reviewing = step === questions.length;
	const question = questions[step];

	const setDraft = (draft: Draft) =>
		setDrafts((current) =>
			current.map((existing, index) => (index === step ? draft : existing)),
		);
	const next = () => setStep((current) => current + 1);

	return (
		<QuestionsCard
			title={input.title}
			progress={
				reviewing
					? m.questions_review_title()
					: m.questions_step_progress({
							step: step + 1,
							count: questions.length,
						})
			}
			footer={
				<>
					<Button variant="ghost" size="sm" onClick={onSkip}>
						{m.questions_skip_action()}
					</Button>
					<div className="flex gap-2">
						{step > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setStep((current) => current - 1)}
							>
								{m.questions_back_action()}
							</Button>
						)}
						{reviewing ? (
							<Button size="sm" onClick={() => onSubmit(drafts)}>
								{m.questions_submit_action()}
							</Button>
						) : (
							<Button size="sm" onClick={next}>
								{m.questions_next_action()}
							</Button>
						)}
					</div>
				</>
			}
		>
			{reviewing ? (
				<ol className="flex flex-col gap-1">
					{answeredQuestions(input, draftAnswers(input, drafts)).map(
						({ number, question: reviewed, answer }) => (
							<li key={number}>
								<button
									type="button"
									onClick={() => setStep(number - 1)}
									className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/50"
								>
									<span className="font-medium">
										{number}. {reviewed.prompt}
									</span>
									<span className="text-muted-foreground">
										{answer
											? answerLine(answer, m.questions_other_label())
											: m.questions_not_answered()}
									</span>
								</button>
							</li>
						),
					)}
				</ol>
			) : (
				<div key={step} className="flex flex-col gap-3">
					<p id={promptId} className="font-medium text-sm">
						{question.prompt}
					</p>
					<QuestionField
						question={question}
						withOther
						draft={drafts[step]}
						onChange={setDraft}
						onPicked={next}
						labelledBy={promptId}
					/>
				</div>
			)}
		</QuestionsCard>
	);
};
