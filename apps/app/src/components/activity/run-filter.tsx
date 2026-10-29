import type { ActivityRunId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ActivityIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import { runTitle } from "@/lib/presentation/activity";
import { m } from "@/paraglide/messages";

/** Says whose assets the Library shows when it opens on an activity entry, with the way back to all of them. */
export const RunFilter = ({ runId }: { runId: ActivityRunId }) => {
	const { data } = useQuery(
		orpc.activity.runs.queryOptions({
			input: {
				ids: [
					runId,
				],
				limit: 1,
			},
		}),
	);
	const run = data?.data[0];

	return (
		<div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/40 py-1.5 ps-3 pe-1.5 text-sm">
			<ActivityIcon
				aria-hidden="true"
				className="size-4 shrink-0 text-muted-foreground"
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
