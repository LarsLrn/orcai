import {
	BrainIcon,
	ChevronDownIcon,
	CircleAlertIcon,
	ListChecksIcon,
	Loader2Icon,
	MessageSquareTextIcon,
} from "lucide-react";
import type { Ref } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Activity, WorkEntry } from "@/lib/ai/turn-view/turn-view";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ReasoningEntry } from "./reasoning-entry";
import { TextEntry } from "./text-entry";
import { ToolEntryPart } from "./tool-entry-part";
import { toolLabels } from "./tool-labels";
import { isFailedStatus } from "./tool-status";

interface WorkLogProps {
	entries: WorkEntry[];
	/** Whether the turn is still streaming. */
	running: boolean;
	activity: Activity | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	ref?: Ref<HTMLDivElement>;
}

const failedCount = (entries: WorkEntry[]) =>
	entries.filter(
		(entry) => entry.kind === "tool" && isFailedStatus(entry.status),
	).length;

export const activityLabel = (activity: Activity) => {
	switch (activity.kind) {
		case "tool":
			return toolLabels(activity.part).active;
		case "thinking":
			return m.chat_work_log_thinking();
		case "working":
			return m.chat_work_log_working();
	}
};

/** The active step while one runs; otherwise the tally so far. */
const headerLabel = (entries: WorkEntry[], activity: Activity | undefined) => {
	if (activity && activity.kind !== "working") {
		return activityLabel(activity);
	}

	const failed = failedCount(entries);

	return failed > 0
		? m.chat_work_log_header_steps_failed({
				count: entries.length,
				failed,
			})
		: m.chat_work_log_header_steps({
				count: entries.length,
			});
};

const EntryIcon = ({ entry }: { entry: WorkEntry }) => {
	if (entry.kind === "reasoning") {
		return <BrainIcon className="size-3 text-muted-foreground" />;
	}

	if (entry.kind === "text") {
		return <MessageSquareTextIcon className="size-3 text-muted-foreground" />;
	}

	const Icon = toolLabels(entry.part).icon;
	const failed = isFailedStatus(entry.status);

	return (
		<Icon
			className={cn(
				"size-3",
				failed ? "text-status-danger" : "text-muted-foreground",
			)}
		/>
	);
};

const Entry = ({ entry }: { entry: WorkEntry }) => {
	switch (entry.kind) {
		case "reasoning":
			return <ReasoningEntry part={entry.part} live={entry.live} />;
		case "text":
			return <TextEntry part={entry.part} />;
		case "tool":
			return <ToolEntryPart part={entry.part} status={entry.status} />;
	}
};

/** Everything a turn did before its answer, folded behind one header. */
export const WorkLog = ({
	entries,
	running,
	activity,
	open,
	onOpenChange,
	ref,
}: WorkLogProps) => {
	const failed = failedCount(entries);

	return (
		<Collapsible
			ref={ref}
			open={open}
			onOpenChange={onOpenChange}
			className="not-prose w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/20"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground text-sm transition-colors duration-150 hover:text-foreground">
				{running ? (
					<Loader2Icon className="size-4 shrink-0 animate-spin" />
				) : failed > 0 ? (
					<CircleAlertIcon className="size-4 shrink-0 text-status-danger" />
				) : (
					<ListChecksIcon className="size-4 shrink-0" />
				)}
				<span className="min-w-0 flex-1 truncate">
					{headerLabel(entries, activity)}
				</span>
				<ChevronDownIcon
					className={cn(
						"size-4 shrink-0 transition-transform duration-150",
						open && "rotate-180",
					)}
				/>
			</CollapsibleTrigger>
			{/* Kept mounted so entries keep timing and measuring while folded. */}
			<CollapsibleContent
				keepMounted
				className="border-border/60 border-t px-3 py-3"
			>
				<ol className="ms-2 border-border border-s">
					{entries.map((entry) => (
						<li key={entry.id} className="relative ps-5 pb-4 last:pb-0">
							<span className="absolute -inset-s-2.5 top-0 grid size-5 place-items-center rounded-full border border-border bg-background">
								<EntryIcon entry={entry} />
							</span>
							<Entry entry={entry} />
						</li>
					))}
				</ol>
			</CollapsibleContent>
		</Collapsible>
	);
};
