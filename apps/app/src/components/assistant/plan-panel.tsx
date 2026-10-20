import type { UseChatHelpers } from "@ai-sdk/react";
import {
	ChevronDownIcon,
	CircleCheckIcon,
	CircleDotIcon,
	CircleIcon,
	CircleMinusIcon,
	ListTodoIcon,
	type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { AddToolApprovalResponse } from "@/components/assistant/confirmation-card";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
	isPlanUpdating,
	latestPlanPart,
	pendingPlanApprovalIds,
} from "@/lib/ai/tools/assistant/plan/latest-plan";
import type { PlanItemStatus } from "@/lib/ai/tools/assistant/plan/plan";
import { planTally } from "@/lib/ai/tools/assistant/plan/plan-tally";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
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
	addToolApprovalResponse,
}: {
	approvalIds: string[];
	addToolApprovalResponse: AddToolApprovalResponse;
}) => {
	const [revising, setRevising] = useState(false);
	const [note, setNote] = useState("");
	const noteId = useId();
	const respond = (approved: boolean, reason?: string) => {
		for (const answer of planApprovalAnswers(approvalIds, {
			approved,
			reason,
		})) {
			void addToolApprovalResponse(answer);
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
 * The conversation's plan, pinned above the composer: the newest `updatePlan`
 * call of the loaded messages. A proposal is approved or revised here.
 */
export const PlanPanel = ({
	messages,
	status,
	addToolApprovalResponse,
}: {
	messages: ChatAgentUIMessage[];
	status: UseChatHelpers<ChatAgentUIMessage>["status"];
	addToolApprovalResponse: AddToolApprovalResponse;
}) => {
	const part = latestPlanPart(messages);
	const [open, setOpen] = usePlanOpen(part && planViewOf(part));
	const regionId = useId();

	if (!part) {
		return null;
	}

	const { title, items } = part.input;
	const running = status === "streaming" || status === "submitted";
	const lastMessage = messages.at(-1);
	const updating =
		running && lastMessage !== undefined && isPlanUpdating(lastMessage);
	// Only the latest reply's proposals can be answered.
	const approvalIds =
		!running && lastMessage?.role === "assistant"
			? pendingPlanApprovalIds(lastMessage)
			: [];
	const current = items.find((item) => item.status === "in_progress");

	return (
		<section
			aria-labelledby={regionId}
			className="not-prose overflow-hidden rounded-xl border bg-card text-sm"
		>
			<h2 id={regionId} className="sr-only">
				{m.assistant_plan_region()}
			</h2>
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50">
					<ChevronDownIcon
						aria-hidden
						className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-panel-open:rotate-0"
					/>
					{updating ? (
						<Spinner className="text-muted-foreground" />
					) : (
						<ListTodoIcon
							aria-hidden
							className="size-4 shrink-0 text-muted-foreground"
						/>
					)}
					<span className="min-w-0 truncate font-medium">{title}</span>
					<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
						{planTally(items)}
					</span>
					{!open && current && (
						<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
							{current.label}
						</span>
					)}
					<span className="sr-only">
						{open ? m.assistant_plan_collapse() : m.assistant_plan_expand()}
					</span>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ScrollArea className="border-t [&_[data-slot=scroll-area-viewport]]:max-h-64">
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
												{item.status === "in_progress" && running ? (
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
					</ScrollArea>
				</CollapsibleContent>
			</Collapsible>
			{approvalIds.length > 0 && (
				<PlanApproval
					key={approvalIds.join()}
					approvalIds={approvalIds}
					addToolApprovalResponse={addToolApprovalResponse}
				/>
			)}
		</section>
	);
};
