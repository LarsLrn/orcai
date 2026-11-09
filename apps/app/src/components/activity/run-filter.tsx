import type { ActivityRunId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ActivityIcon, XIcon } from "lucide-react";
import { runTitle } from "@/components/activity/activity-text";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The activity entry the Library opens on; the asset list loads it. */
export const runFilterQuery = (runId: ActivityRunId) =>
	orpc.activity.runs.queryOptions({
		input: {
			ids: [
				runId,
			],
			limit: 1,
		},
	});

/** Says whose assets the Library shows when it opens on an activity entry, with the way back to all of them. */
export const RunFilter = ({ runId }: { runId: ActivityRunId }) => {
	const { data } = useQuery(runFilterQuery(runId));
	const run = data?.data[0];

	return (
		<div className="bg-muted/40 mb-4 flex items-center gap-2 rounded-xl border py-1.5 ps-3 pe-1.5 text-sm">
			<ActivityIcon
				aria-hidden="true"
				className="text-muted-foreground size-4 shrink-0"
			/>
			<span className="min-w-0 flex-1 truncate">
				{m.activity_library_run_filter({
					title: run ? runTitle(run) : m.activity_title(),
				})}
			</span>
			<Link
				from="/app/library/assets/"
				to="."
				search={(previous) => ({
					...previous,
					run: undefined,
					pageIndex: 0,
				})}
				aria-label={m.activity_library_run_filter_clear()}
				className={buttonVariants({
					variant: "ghost",
					size: "icon-xs",
				})}
			>
				<XIcon aria-hidden="true" />
			</Link>
		</div>
	);
};
