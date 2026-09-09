import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import type { ToolPart } from "@/components/chat/message/classify-turn";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isFailedStatus, toolStatus, toolStatusLabels } from "./tool-status";

interface ToolEntryProps {
	part: ToolPart;
	running: boolean;
	/** Outcome sentence such as "Searched the sources, found 6 passages". */
	label: string;
	/** Human-readable output; when absent the raw result is shown in details. */
	children?: ReactNode;
}

/** Generic tool entry that the typed renderers build on. */
export const ToolEntry = ({
	part,
	running,
	label,
	children,
}: ToolEntryProps) => {
	const status = toolStatus(part, running);
	const showsRawResult = children === undefined;

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
						{toolStatusLabels[status]}
					</Badge>
				)}
			</div>
			{children}
			<ToolDetails label={showsRawResult ? "Details" : "Parameters"}>
				<ToolInput
					input={part.input}
					rawInput={"rawInput" in part ? part.rawInput : undefined}
					errorText={part.errorText}
				/>
				{(showsRawResult || part.errorText) && (
					<ToolOutput output={part.output} errorText={part.errorText} />
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
