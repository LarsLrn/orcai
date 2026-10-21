import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * A collapsible card above the composer: icon, title and tally in the
 * trigger, a summary while collapsed, the body below it and an optional
 * footer that stays visible either way.
 */
export const ComposerPanel = ({
	label,
	icon,
	title,
	tally,
	summary,
	open,
	onOpenChange,
	expandLabel,
	collapseLabel,
	children,
	footer,
}: {
	/** Names the region for assistive technology. */
	label: string;
	icon: ReactNode;
	title: ReactNode;
	tally?: string;
	/** Shown in the trigger while the panel is collapsed. */
	summary?: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	expandLabel: string;
	collapseLabel: string;
	children: ReactNode;
	footer?: ReactNode;
}) => {
	const regionId = useId();

	return (
		<section
			aria-labelledby={regionId}
			className="not-prose overflow-hidden rounded-xl border bg-card text-sm"
		>
			<h2 id={regionId} className="sr-only">
				{label}
			</h2>
			<Collapsible open={open} onOpenChange={onOpenChange}>
				<CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/50">
					<ChevronDownIcon
						aria-hidden
						className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-panel-open:rotate-0"
					/>
					{icon}
					<span className="min-w-0 truncate font-medium">{title}</span>
					{tally && (
						<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
							{tally}
						</span>
					)}
					{!open && summary && (
						<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
							{summary}
						</span>
					)}
					<span className="sr-only">{open ? collapseLabel : expandLabel}</span>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ScrollArea className="border-t [&_[data-slot=scroll-area-viewport]]:max-h-64">
						{children}
					</ScrollArea>
				</CollapsibleContent>
			</Collapsible>
			{footer}
		</section>
	);
};
