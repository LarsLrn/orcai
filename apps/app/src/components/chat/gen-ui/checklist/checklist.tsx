import { ChevronDownIcon } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	StatusIcon,
	statusTone,
	Tally,
} from "@/components/chat/gen-ui/status-icon";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChecklistView } from "@/lib/ai/tools/gen-ui/checklist/read";
import { statusLabel } from "@/lib/ai/tools/gen-ui/status";
import { cn } from "@/lib/utils";

export const Checklist = ({
	view,
	streaming,
}: {
	view: ChecklistView;
	streaming: boolean;
}) => {
	const { title, description, items } = view;
	const statuses = items.map((item) => item.status);
	const withStatus = statuses.some(Boolean);
	const withHeader = Boolean(title || description || withStatus);

	return (
		<div className="bg-card overflow-hidden rounded-xl border">
			{withHeader && (
				<div className="flex items-start justify-between gap-4 border-b px-4 py-3">
					<div className="min-w-0 space-y-1">
						{title && <h3 className="text-sm font-medium">{title}</h3>}
						{description && (
							<p className="text-muted-foreground text-xs">{description}</p>
						)}
					</div>
					{withStatus && <Tally statuses={statuses} />}
				</div>
			)}
			<ul className="divide-y">
				{items.map((item, index) => {
					const { status } = item;
					const expandable = Boolean(item.body || item.quote);
					return (
						<li key={index}>
							<Collapsible>
								<CollapsibleTrigger
									disabled={!expandable}
									className="group hover:bg-muted/50 data-panel-open:bg-muted/40 flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm disabled:cursor-default disabled:hover:bg-transparent"
								>
									{withStatus && (
										<StatusIcon status={status} pending={streaming} />
									)}
									<span className="min-w-0 flex-1">
										<span className="block">{item.label}</span>
										{item.summary && (
											<span className="text-muted-foreground block text-xs">
												{item.summary}
											</span>
										)}
									</span>
									{status && status !== "met" && (
										<span className={cn("text-xs", statusTone[status])}>
											{statusLabel(status)}
										</span>
									)}
									<ChevronDownIcon
										aria-hidden
										className={cn(
											"text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open:rotate-180",
											!expandable && "invisible",
										)}
									/>
								</CollapsibleTrigger>
								{expandable && (
									<CollapsibleContent
										className={cn(
											"text-muted-foreground space-y-2 px-4 pb-3 text-sm",
											withStatus && "pl-11",
										)}
									>
										{item.quote && (
											<blockquote className="border-l-2 pl-3 font-mono text-xs">
												{item.quote}
											</blockquote>
										)}
										{item.body && (
											<MessageResponse>{item.body}</MessageResponse>
										)}
									</CollapsibleContent>
								)}
							</Collapsible>
						</li>
					);
				})}
				{items.length === 0 && streaming && (
					<li className="space-y-2 px-4 py-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</li>
				)}
			</ul>
		</div>
	);
};
