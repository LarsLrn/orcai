import { useRef } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { toolStatusLabel } from "@/components/chat/message/work-log/tool-status";
import { Badge } from "@/components/ui/badge";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import {
	type AskUserOutput,
	askUserInputSchema,
} from "@/lib/ai/tools/questions/ask-user";
import type { ToolPartOf, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { m } from "@/paraglide/messages";
import { AnsweredQuestions } from "./answered-questions";
import { type Draft, draftAnswers } from "./draft";
import { QuestionStepper } from "./question-stepper";
import { QuestionsCard } from "./questions-card";
import { QuizPager } from "./quiz-pager";

/**
 * `askUser` in the answer: the questions to answer while the call waits,
 * read-only with the answers once given. Only the first answer counts.
 */
export const QuestionsWidget = ({
	part,
	status,
	answers,
}: {
	part: ToolPartOf<"askUser">;
	status: ToolStatus | null;
	/** Left out unless the call can be answered. */
	answers: StepAnswers | undefined;
}) => {
	const answered = useRef(false);
	const parsed = askUserInputSchema.safeParse(part.input);

	if (!parsed.success) {
		return part.state === "input-streaming" ? (
			<QuestionsCard title={undefined}>
				<Shimmer className="text-sm">{m.questions_tool_active()}</Shimmer>
			</QuestionsCard>
		) : (
			<p className="text-muted-foreground text-sm">
				{m.gen_ui_cannot_display()}
			</p>
		);
	}
	const input = parsed.data;

	if (answers && part.state === "input-available") {
		const send = (output: AskUserOutput) => {
			if (answered.current) return;
			answered.current = true;
			answers.output({
				tool: "askUser",
				toolCallId: part.toolCallId,
				output,
			});
		};
		const submit = (drafts: Draft[]) =>
			send({
				status: "answered",
				answers: draftAnswers(input, drafts),
			});
		const skip = () =>
			send({
				status: "skipped",
			});
		const Round = input.mode === "quiz" ? QuizPager : QuestionStepper;
		return <Round input={input} onSubmit={submit} onSkip={skip} />;
	}

	const output = part.state === "output-available" ? part.output : undefined;
	const shownStatus: ToolStatus | null =
		output?.status === "skipped" ? "skipped" : status;

	return (
		<QuestionsCard
			title={input.title}
			status={
				shownStatus && (
					<Badge variant="outline">{toolStatusLabel(shownStatus)}</Badge>
				)
			}
		>
			<AnsweredQuestions input={input} output={output} />
		</QuestionsCard>
	);
};
