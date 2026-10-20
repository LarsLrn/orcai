import type { DeepPartial } from "ai";
import { ChevronDownIcon } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import type { ChecklistInput } from "@/components/chat/gen-ui/checklist/schema";
import {
	type Status,
	statusLabel,
	statusSchema,
} from "@/components/chat/gen-ui/status";
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
import { cn } from "@/lib/utils";

/** A status cut off mid-stream is not one yet. */
const statusOf = (value: unknown): Status | undefined => {
	const parsed = statusSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
};

const textOf = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/** Streamed input is unvalidated, so every field may be missing or malformed. */
const itemOf = (value: unknown) =>
	isRecord(value)
		? {
				label: textOf(value.label),
				status: statusOf(value.status),
				summary: textOf(value.summary),
				body: textOf(value.body),
				quote: textOf(value.quote),
			}
		: undefined;

export const Checklist = ({
	input,
	streaming,
}: {
	input: DeepPartial<ChecklistInput>;
	streaming: boolean;
}) => {
	const title = textOf(input.title);
	const description = textOf(input.description);
	const items = (Array.isArray(input.items) ? input.items : []).map(itemOf);
	const statuses = items.map((item) => item?.status);
	const withStatus = statuses.some(Boolean);
	const withHeader = Boolean(title || description || withStatus);

	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			{withHeader && (
				<div className="flex items-start justify-between gap-4 border-b px-4 py-3">
					<div className="min-w-0 space-y-1">
						{title && <h3 className="font-medium text-sm">{title}</h3>}
						{description && (
							<p className="text-muted-foreground text-xs">{description}</p>
						)}
					</div>
					{withStatus && <Tally statuses={statuses} />}
				</div>
			)}
			<ul className="divide-y">
				{items.map((item, index) => {
					if (!item) {
						return null;
					}
					const { status } = item;
					const expandable = Boolean(item.body || item.quote);
					return (
						<li key={index}>
							<Collapsible>
								<CollapsibleTrigger
									disabled={!expandable}
									className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent data-panel-open:bg-muted/40"
								>
									{withStatus && (
										<StatusIcon status={status} pending={streaming} />
									)}
									<span className="min-w-0 flex-1">
										<span className="block">{item.label}</span>
										{item.summary && (
											<span className="block text-muted-foreground text-xs">
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
											"size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180",
											!expandable && "invisible",
										)}
									/>
								</CollapsibleTrigger>
								{expandable && (
									<CollapsibleContent
										className={cn(
											"space-y-2 px-4 pb-3 text-muted-foreground text-sm",
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
