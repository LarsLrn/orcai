import {
	CircleCheckIcon,
	CircleDotIcon,
	CircleIcon,
	CircleMinusIcon,
	ListTodoIcon,
	type LucideIcon,
} from "lucide-react";
import { use, useId, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ComposerPanel } from "@/components/chat/composer-panel";
import { StepAnswersContext } from "@/components/chat/step-answers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { PlanItemStatus } from "@/lib/ai/tools/assistant/plan/plan";
import { planTally } from "@/lib/ai/tools/assistant/plan/plan-tally";
import type { TurnPlan } from "@/lib/ai/turn-view/turn-view";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
	nextPlanOpen,
	type PlanView,
	planApprovalAnswers,
	planViewOf,
} from "./plan-panel-state";

const statusIcons: Record<
	PlanItemStatus,
	{
		icon: LucideIcon;
		tone: string;
		label: () => string;
	}
> = {
	pending: {
		icon: CircleIcon,
		tone: "text-muted-foreground",
		label: m.assistant_plan_status_pending,
	},
	in_progress: {
		icon: CircleDotIcon,
		tone: "text-accent-brand",
		label: m.assistant_plan_status_in_progress,
	},
	done: {
		icon: CircleCheckIcon,
		tone: "text-status-success",
		label: m.assistant_plan_status_done,
	},
	skipped: {
		icon: CircleMinusIcon,
		tone: "text-muted-foreground",
		label: m.assistant_plan_status_skipped,
	},
};

const usePlanOpen = (view: PlanView | undefined) => {
	const [open, setOpen] = useState(true);
	const [shown, setShown] = useState(view);

	if (
		view &&
		(view.title !== shown?.title ||
			view.finished !== shown.finished ||
			view.awaitingApproval !== shown.awaitingApproval)
	) {
		setShown(view);
		setOpen(
			nextPlanOpen({
				previous: shown,
				next: view,
				open,
			}),
		);
	}

	return [
		open,
		setOpen,
	] as const;
};

/** Revising declines the proposal with the user's note, which the model reads. */
const PlanApproval = ({
	approvalIds,
	answers,
}: {
	approvalIds: string[];
	answers: StepAnswers;
}) => {
	const [revising, setRevising] = useState(false);
	const [note, setNote] = useState("");
	const noteId = useId();
	const respond = (approved: boolean, reason?: string) => {
		for (const answer of planApprovalAnswers(approvalIds, {
			approved,
			reason,
		})) {
			answers.approve(answer);
		}
	};

	if (revising) {
		return (
			<form
				className="space-y-2 border-t px-4 py-3"
				onSubmit={(event) => {
					event.preventDefault();
					if (note.trim()) respond(false, note.trim());
				}}
			>
				<Label htmlFor={noteId}>{m.assistant_plan_revise_note_label()}</Label>
				<Textarea
					id={noteId}
					value={note}
					maxLength={1000}
					autoFocus
					onChange={(event) => setNote(event.target.value)}
				/>
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setRevising(false)}
					>
						{m.common_cancel_button()}
					</Button>
					<Button type="submit" size="sm" disabled={!note.trim()}>
						{m.assistant_plan_revise_submit()}
					</Button>
				</div>
			</form>
		);
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
			<p className="text-muted-foreground text-xs">
				{m.assistant_plan_awaiting_approval()}
			</p>
			<div className="flex gap-2">
				<Button variant="outline" size="sm" onClick={() => setRevising(true)}>
					{m.assistant_plan_revise()}
				</Button>
				<Button size="sm" onClick={() => respond(true)}>
					{m.assistant_plan_approve()}
				</Button>
			</div>
		</div>
	);
};

/**
 * The conversation's plan, pinned above the composer. A proposal is approved
 * or revised here.
 */
export const PlanPanel = ({
	plan,
	busy,
}: {
	plan: TurnPlan | undefined;
	/** A turn is being sent or streamed. */
	busy: boolean;
}) => {
	const answers = use(StepAnswersContext);
	const [open, setOpen] = usePlanOpen(plan && planViewOf(plan.part));
	if (!plan) {
		return null;
	}

	const { updating, approvalIds } = plan;
	const { title, items } = plan.part.input;
	const current = items.find((item) => item.status === "in_progress");

	return (
		<ComposerPanel
			label={m.assistant_plan_region()}
			icon={
				updating ? (
					<Spinner className="text-muted-foreground" />
				) : (
					<ListTodoIcon
						aria-hidden
						className="size-4 shrink-0 text-muted-foreground"
					/>
				)
			}
			title={title}
			tally={planTally(items)}
			summary={current?.label}
			open={open}
			onOpenChange={setOpen}
			expandLabel={m.assistant_plan_expand()}
			collapseLabel={m.assistant_plan_collapse()}
			footer={
				answers &&
				approvalIds.length > 0 && (
					<PlanApproval
						key={approvalIds.join()}
						approvalIds={approvalIds}
						answers={answers}
					/>
				)
			}
		>
			<ol className="space-y-1.5 px-4 py-2.5">
				{items.map((item, index) => {
					const { icon: Icon, tone, label } = statusIcons[item.status];

					return (
						<li key={index} className="flex items-start gap-2">
							<Icon
								role="img"
								aria-label={label()}
								className={cn("mt-0.5 size-4 shrink-0", tone)}
							/>
							<div className="min-w-0">
								<span
									className={cn(
										item.status === "skipped" &&
											"text-muted-foreground line-through",
									)}
								>
									{item.status === "in_progress" && busy ? (
										<Shimmer>{item.label}</Shimmer>
									) : (
										item.label
									)}
								</span>
								{item.details && (
									<p className="wrap-anywhere whitespace-pre-line text-muted-foreground text-xs">
										{item.details}
									</p>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</ComposerPanel>
	);
};
