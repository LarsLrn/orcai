import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
	isFailedStatus,
	toolErrorMessage,
	toolStatusLabel,
} from "./tool-status";

interface ToolEntryProps {
	part: ToolPart;
	status: ToolStatus | null;
	/** Outcome sentence such as "Searched the sources, found 6 passages". */
	label: ReactNode;
	/** Human-readable output; when absent the raw result is shown in details. */
	children?: ReactNode;
}

/** Generic tool entry that the typed renderers build on. */
export const ToolEntry = ({
	part,
	status,
	label,
	children,
}: ToolEntryProps) => {
	const showsRawResult = children === undefined;
	// A closed call's sentence is for the model; the badge already says it.
	const errorText =
		status === "skipped" || status === "interrupted"
			? undefined
			: part.errorText;
	const failure = status === "failed" ? toolErrorMessage(errorText) : undefined;

	return (
		<div className="min-w-0">
			<div className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate font-medium text-sm">
					{label}
				</span>
				{status && (
					<Badge
						variant={isFailedStatus(status) ? "danger" : "outline"}
						className="shrink-0"
					>
						{toolStatusLabel(status)}
					</Badge>
				)}
			</div>
			{failure && <p className="mt-1 text-status-danger text-xs">{failure}</p>}
			{children}
			<ToolDetails
				label={
					showsRawResult
						? m.chat_work_log_tool_details_label()
						: m.chat_work_log_tool_parameters_label()
				}
			>
				<ToolInput input={part.input} errorText={errorText} />
				{(showsRawResult || errorText) && (
					<ToolOutput output={part.output} errorText={errorText} />
				)}
			</ToolDetails>
		</div>
	);
};

const ToolDetails = ({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) => {
	const [open, setOpen] = useState(false);

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="mt-2">
			<CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-xs transition-colors duration-150 hover:text-foreground">
				{label}
				<ChevronDownIcon
					className={cn(
						"size-3 transition-transform duration-150",
						open && "rotate-180",
					)}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-1.5 space-y-2 rounded-md bg-muted/40 p-2">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
};
