import type { ActivityRun } from "@orcai/schema";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ActivityIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { FailureRow, SuggestionsRow } from "./activity-attention";
import { RunRow } from "./activity-run-row";

const RUNS_PAGE_SIZE = 10;

const Section = ({
	title,
	count,
	children,
}: {
	title: string;
	count?: number;
	children: React.ReactNode;
}) => (
	<section className="py-2">
		<h3 className="flex items-center gap-2 px-4 py-1.5 font-medium text-muted-foreground text-xs">
			{title}
			{count ? (
				<span className="rounded-full bg-muted px-1.5 text-foreground tabular-nums">
					{count}
				</span>
			) : null}
		</h3>
		<ul>{children}</ul>
	</section>
);

/** What needs the user first, then the running and recent entries, newest first. */
export const ActivityPanel = ({
	running,
	className,
}: {
	/** The polled summary's running entries, fresher than the list's. */
	running: readonly ActivityRun[];
	className?: string;
}) => {
	const panel = useRef<HTMLDivElement>(null);
	const attention = useQuery(
		orpc.activity.attention.queryOptions({
			input: {},
		}),
	);
	const runs = useInfiniteQuery(
		orpc.activity.runs.infiniteOptions({
			input: (before: ActivityRun["id"] | undefined) => ({
				before,
				limit: RUNS_PAGE_SIZE,
			}),
			initialPageParam: undefined,
			getNextPageParam: (last) =>
				last.hasMore ? last.data.at(-1)?.id : undefined,
		}),
	);
	const runningIds = new Set(running.map((run) => run.id));
	const recent = (runs.data?.pages ?? [])
		.flatMap((page) => page.data)
		.filter((run) => run.state !== "running" && !runningIds.has(run.id));
	const entries = [
		...running,
		...recent,
	];
	const suggestions = attention.data?.suggestions ?? [];
	const failures = attention.data?.failures ?? [];
	const attentionCount =
		suggestions.reduce((total, entry) => total + entry.count, 0) +
		failures.length;
	const focusPanel = () => panel.current?.focus();

	if (attention.isPending || runs.isPending) {
		return (
			<div className="flex justify-center py-10">
				<Spinner className="text-muted-foreground" />
			</div>
		);
	}
	if (attention.isError || runs.isError) {
		return (
			<p className="px-4 py-8 text-center text-muted-foreground text-sm">
				{m.activity_load_error()}
			</p>
		);
	}

	return (
		<div
			ref={panel}
			tabIndex={-1}
			className={cn(
				"max-h-[min(34rem,calc(var(--available-height)-4rem))] overflow-y-auto outline-none",
				className,
			)}
		>
			{entries.length === 0 && attentionCount === 0 ? (
				<Empty className="p-8">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ActivityIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>{m.activity_empty_title()}</EmptyTitle>
						<EmptyDescription>
							{m.activity_empty_description()}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{attentionCount > 0 ? (
				<Section title={m.activity_attention_section()} count={attentionCount}>
					{suggestions.map((entry) => (
						<SuggestionsRow
							key={entry.organization.id}
							organization={entry.organization}
							count={entry.count}
						/>
					))}
					{failures.map((failure) => (
						<FailureRow
							key={failure.occurrenceId}
							failure={failure}
							onDismissed={focusPanel}
						/>
					))}
				</Section>
			) : null}
			{entries.length > 0 ? (
				<Section title={m.activity_recent_section()}>
					{entries.map((run) => (
						<RunRow key={run.id} run={run} onDismissed={focusPanel} />
					))}
				</Section>
			) : null}
			{runs.hasNextPage ? (
				<div className="flex justify-center pb-3">
					<Button
						variant="ghost"
						size="sm"
						loading={runs.isFetchingNextPage}
						onClick={() => void runs.fetchNextPage()}
					>
						{m.activity_show_older()}
					</Button>
				</div>
			) : null}
		</div>
	);
};
