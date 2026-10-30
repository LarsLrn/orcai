import type { ActivityRun } from "@orcai/schema";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronDownIcon,
	CircleAlertIcon,
	CircleSlashIcon,
	EqualIcon,
	LoaderCircleIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import {
	fieldSummary,
	type MemberStage,
	memberStage,
	memberStageLabels,
	runSummary,
	runTitle,
} from "@/lib/presentation/activity";
import { formatRelativeTime } from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { activityOpen, RUNNING_POLL_MS } from "./activity-state";
import { RunProgress, RunWell } from "./activity-visuals";

const MEMBERS_PAGE_SIZE = 10;

const STAGE_ICONS = {
	failed: <CircleAlertIcon className="text-status-danger" aria-hidden="true" />,
	processing: (
		<LoaderCircleIcon
			className="animate-spin text-status-processing"
			aria-hidden="true"
		/>
	),
	indexing: (
		<LoaderCircleIcon
			className="animate-spin text-status-processing"
			aria-hidden="true"
		/>
	),
	metadata: (
		<LoaderCircleIcon
			className="animate-spin text-status-processing"
			aria-hidden="true"
		/>
	),
	updated: <CheckIcon className="text-status-success" aria-hidden="true" />,
	ready: <CheckIcon className="text-status-success" aria-hidden="true" />,
	unchanged: <EqualIcon className="text-muted-foreground" aria-hidden="true" />,
	stopped: (
		<CircleSlashIcon className="text-muted-foreground" aria-hidden="true" />
	),
} satisfies Record<MemberStage, React.ReactNode>;

export const textLink =
	"rounded-sm outline-none underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/75";

const closeActivity = () => activityOpen.set(false);

/** Where the entry's work can be seen. */
const RunLink = ({ run }: { run: ActivityRun }) => {
	const className = cn(
		textLink,
		"inline-block font-medium text-primary text-xs",
	);
	if (run.kind === "export") {
		return (
			<Link
				to="/app/account/data"
				onClick={closeActivity}
				className={className}
			>
				{m.activity_run_open_export()}
			</Link>
		);
	}
	if (run.asset) {
		return (
			<Link
				to="/app/library/assets/$assetId"
				params={{
					assetId: run.asset.id,
				}}
				onClick={closeActivity}
				className={className}
			>
				{m.activity_run_open_asset()}
			</Link>
		);
	}
	if (run.repository) {
		return (
			<Link
				to="/app/library/repositories/$blockId"
				params={{
					blockId: run.repository.id,
				}}
				onClick={closeActivity}
				className={className}
			>
				{m.activity_run_open_repository({
					repository: run.repository.name,
				})}
			</Link>
		);
	}
	if (run.progress.total === 0) return null;
	return (
		<Link
			to="/app/library/assets"
			search={{
				run: run.id,
			}}
			onClick={closeActivity}
			className={className}
		>
			{m.activity_run_show_in_library()}
		</Link>
	);
};

/** The entry's assets with where each stands, a page at a time, and how many got each field. */
const RunDetails = ({ run }: { run: ActivityRun }) => {
	const members = useInfiniteQuery(
		orpc.activity.runMembers.infiniteOptions({
			input: (pageIndex: number) => ({
				runId: run.id,
				pageIndex,
				pageSize: MEMBERS_PAGE_SIZE,
			}),
			initialPageParam: 0,
			getNextPageParam: (last, pages) =>
				pages.length * MEMBERS_PAGE_SIZE < last.rowCount
					? pages.length
					: undefined,
			refetchInterval: run.state === "running" ? RUNNING_POLL_MS : false,
		}),
	);
	const pages = members.data?.pages ?? [];
	const rows = pages.flatMap((page) => page.data);
	const first = pages[0];
	const remaining = (first?.rowCount ?? 0) - rows.length;

	if (members.isPending && run.kind !== "export") {
		return <Spinner className="mt-3 text-muted-foreground" />;
	}

	return (
		<div className="mt-3 space-y-2">
			{members.isError && !members.data && run.kind !== "export" ? (
				<p className="text-muted-foreground text-xs">
					{m.activity_load_error()}{" "}
					<button
						type="button"
						onClick={() => void members.refetch()}
						className={cn(textLink, "font-medium text-primary")}
					>
						{m.common_retry_button()}
					</button>
				</p>
			) : null}
			{run.metadata && first ? (
				<p className="text-muted-foreground text-xs">
					{fieldSummary(first.fields, run.metadata.unchanged)}
				</p>
			) : null}
			{rows.length > 0 ? (
				<ul className="space-y-1">
					{rows.map((member) => {
						const stage = memberStage(member);
						return (
							<li
								key={member.asset.id}
								className="flex items-center gap-2 text-xs [&>svg]:size-3.5 [&>svg]:shrink-0"
							>
								{stage ? STAGE_ICONS[stage] : null}
								<Link
									to="/app/library/assets/$assetId"
									params={{
										assetId: member.asset.id,
									}}
									onClick={closeActivity}
									className={cn(textLink, "min-w-0 truncate")}
								>
									{member.asset.title}
								</Link>
								{stage ? (
									<span className="ml-auto shrink-0 text-muted-foreground">
										{memberStageLabels[stage]()}
									</span>
								) : null}
							</li>
						);
					})}
					{remaining > 0 ? (
						<li>
							<button
								type="button"
								disabled={members.isFetchingNextPage}
								onClick={() => void members.fetchNextPage()}
								className={cn(textLink, "text-muted-foreground text-xs")}
							>
								{m.activity_members_more({
									count: remaining,
								})}
							</button>
						</li>
					) : null}
				</ul>
			) : null}
			<RunLink run={run} />
		</div>
	);
};

/** One entry of Running and recent: what it did, how it went, and its assets on demand. */
export const RunRow = ({
	run,
	onDismissed,
}: {
	run: ActivityRun;
	/** Takes focus somewhere else once the row is gone. */
	onDismissed: () => void;
}) => {
	const [expanded, setExpanded] = useState(false);
	const title = runTitle(run);
	const dismiss = useMutation(
		orpc.activity.dismissRun.mutationOptions({
			onSuccess: onDismissed,
			onError: (error) =>
				toast.error(m.activity_dismiss_toast_error(), {
					description: reasonMessageOf(error),
				}),
		}),
	);

	return (
		<li className="px-2">
			<div className="flex items-start gap-3 rounded-xl px-2 py-2">
				<RunWell run={run} />
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm" title={title}>
						{title}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						{runSummary(run)}
					</p>
					{run.state === "running" &&
					run.kind !== "export" &&
					run.progress.total > 0 ? (
						<RunProgress run={run} label={title} className="mt-2" />
					) : null}
					{expanded ? <RunDetails run={run} /> : null}
				</div>
				<span className="flex shrink-0 items-center gap-1">
					<span className="hidden text-muted-foreground text-xs sm:inline">
						{formatRelativeTime(run.createdAt, {
							style: "narrow",
						})}
					</span>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-expanded={expanded}
						aria-label={
							expanded
								? m.activity_run_details_hide({
										title,
									})
								: m.activity_run_details_show({
										title,
									})
						}
						onClick={() => setExpanded(!expanded)}
					>
						<ChevronDownIcon
							aria-hidden="true"
							className={cn("transition-transform", expanded && "rotate-180")}
						/>
					</Button>
					{run.state === "running" ? (
						<span className="size-6" />
					) : (
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={m.activity_dismiss_label({
								title,
							})}
							disabled={dismiss.isPending}
							onClick={() =>
								dismiss.mutate({
									runId: run.id,
								})
							}
						>
							<XIcon aria-hidden="true" />
						</Button>
					)}
				</span>
			</div>
		</li>
	);
};
