import { use, useId } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { StatusIcon, statusTone } from "@/components/chat/gen-ui/status-icon";
import { SendMessageContext } from "@/components/chat/send-message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { QuizResultView } from "@/lib/ai/tools/gen-ui/quiz-result/read";
import {
	verdictLabel,
	verdictStatus,
} from "@/lib/ai/tools/gen-ui/quiz-result/verdict";
import type { QuizResult as GradedQuiz } from "@/lib/ai/tools/questions/quiz-result";
import { formatCount } from "@/lib/presentation/format-number";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type GradedQuestion = GradedQuiz["sections"][number]["questions"][number];

const score = ({ earned, points }: { earned: number; points: number }) =>
	m.gen_ui_quiz_score({
		earned: formatCount(earned),
		points: formatCount(points),
		count: points,
	});

/** A fully correct question is one line; any other shows the answer, what was expected and why. */
const GradedRow = ({ question }: { question: GradedQuestion }) => {
	const status = verdictStatus[question.verdict];
	const correct = question.verdict === "correct";

	return (
		<li className="flex gap-3 px-4 py-2.5 text-sm">
			<StatusIcon
				status={status}
				label={verdictLabel(question.verdict)}
				className="mt-0.5"
			/>
			<div className="min-w-0 flex-1 space-y-1.5">
				<div className="flex gap-3">
					<span className="min-w-0 flex-1">
						{question.number}. {question.prompt}
					</span>
					<span
						className={cn(
							"shrink-0 text-xs tabular-nums",
							correct ? "text-muted-foreground" : statusTone[status],
						)}
					>
						{score(question)}
					</span>
				</div>
				{!correct && (
					<dl className="text-muted-foreground space-y-1">
						<div>
							<dt className="text-foreground font-medium">
								{m.gen_ui_quiz_your_answer()}
							</dt>
							<dd className={cn(!question.answer && "italic")}>
								{question.answer ?? m.questions_not_answered()}
							</dd>
						</div>
						{question.expected && (
							<div>
								<dt className="text-foreground font-medium">
									{m.gen_ui_quiz_expected()}
								</dt>
								<dd>
									<MessageResponse>{question.expected}</MessageResponse>
								</dd>
							</div>
						)}
						{question.explanation && (
							<dd>
								<MessageResponse>{question.explanation}</MessageResponse>
							</dd>
						)}
					</dl>
				)}
			</div>
		</li>
	);
};

/** The graded quiz: the score, each section's subtotal, and Practice once something was missed. */
export const QuizResult = ({
	view,
}: {
	view: QuizResultView;
	streaming: boolean;
}) => {
	const send = use(SendMessageContext);
	const titleId = useId();
	const { result } = view;

	if (!result) {
		return (
			<div className="bg-card space-y-2 rounded-xl border px-4 py-3">
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		);
	}

	const missed = result.sections.some((section) =>
		section.questions.some((question) => question.verdict !== "correct"),
	);
	const multipleSections = result.sections.length > 1;

	return (
		// biome-ignore lint/a11y/useSemanticElements: groups content, not form controls
		<div
			role="group"
			aria-labelledby={titleId}
			className="not-prose bg-card overflow-hidden rounded-xl border"
		>
			<div className="flex items-center justify-between gap-4 border-b px-4 py-3">
				<h3 id={titleId} className="text-sm font-medium">
					{result.title ?? m.gen_ui_quiz_result_title()}
				</h3>
				<span className="text-sm font-medium tabular-nums">
					{score(result)}
				</span>
			</div>
			{result.sections.map((section, index) => (
				<section key={index} className="border-b last:border-b-0">
					{multipleSections && (
						<div className="bg-muted/40 text-muted-foreground flex justify-between gap-4 px-4 py-1.5 text-xs">
							<span>{section.title ?? m.gen_ui_quiz_section_untitled()}</span>
							<span className="tabular-nums">{score(section)}</span>
						</div>
					)}
					<ol className="divide-y">
						{section.questions.map((question) => (
							<GradedRow key={question.number} question={question} />
						))}
					</ol>
				</section>
			))}
			{missed && (
				<div className="flex justify-end border-t px-4 py-3">
					<Button
						variant="outline"
						size="sm"
						disabled={!send}
						onClick={() => void send?.(m.gen_ui_quiz_practice_message())}
					>
						{m.gen_ui_quiz_practice_action()}
					</Button>
				</div>
			)}
		</div>
	);
};
