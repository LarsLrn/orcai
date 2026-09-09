import {
	BrainIcon,
	ChevronDownIcon,
	CircleAlertIcon,
	ListChecksIcon,
	Loader2Icon,
	MessageSquareTextIcon,
} from "lucide-react";
import { useState } from "react";
import type { WorkEntry } from "@/components/chat/message/classify-turn";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ReasoningEntry } from "./reasoning-entry";
import { TextEntry } from "./text-entry";
import { ToolEntryPart } from "./tool-entry-part";
import { toolLabels } from "./tool-labels";
import { isFailedStatus, toolStatus } from "./tool-status";

interface WorkLogProps {
	entries: WorkEntry[];
	/** Whether the turn is still streaming. Decides running versus orphaned. */
	running: boolean;
}

const failedCount = (entries: WorkEntry[], running: boolean) =>
	entries.filter(
		(entry) =>
			entry.kind === "tool" && isFailedStatus(toolStatus(entry.part, running)),
	).length;

/** The active step while one runs; otherwise the tally so far. */
const headerLabel = (entries: WorkEntry[], running: boolean) => {
	const last = entries.at(-1);

	if (running && last?.kind === "tool" && toolStatus(last.part, true)) {
		return toolLabels(last.part).active;
	}

	if (
		running &&
		last?.kind === "reasoning" &&
		last.part.state === "streaming"
	) {
		return "Thinking";
	}

	const failed = failedCount(entries, running);
	const steps = `${entries.length} ${entries.length === 1 ? "step" : "steps"}`;

	return failed > 0 ? `${steps} · ${failed} failed` : steps;
};

const EntryIcon = ({
	entry,
	running,
}: {
	entry: WorkEntry;
	running: boolean;
}) => {
	if (entry.kind === "reasoning") {
		return <BrainIcon className="size-3 text-muted-foreground" />;
	}

	if (entry.kind === "text") {
		return <MessageSquareTextIcon className="size-3 text-muted-foreground" />;
	}

	const Icon = toolLabels(entry.part).icon;
	const failed = isFailedStatus(toolStatus(entry.part, running));

	return (
		<Icon
			className={cn(
				"size-3",
				failed ? "text-status-danger" : "text-muted-foreground",
			)}
		/>
	);
};

const Entry = ({ entry, running }: { entry: WorkEntry; running: boolean }) => {
	switch (entry.kind) {
		case "reasoning":
			return <ReasoningEntry part={entry.part} />;
		case "text":
			return <TextEntry part={entry.part} />;
		case "tool":
			return <ToolEntryPart part={entry.part} running={running} />;
	}
};

/** Everything a turn did before its answer, folded behind one header. */
export const WorkLog = ({ entries, running }: WorkLogProps) => {
	const [open, setOpen] = useState(false);
	const failed = failedCount(entries, running);

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
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
					{headerLabel(entries, running)}
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
								<EntryIcon entry={entry} running={running} />
							</span>
							<Entry entry={entry} running={running} />
						</li>
					))}
				</ol>
			</CollapsibleContent>
		</Collapsible>
	);
};
