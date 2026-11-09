import { skipToken, useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useId } from "react";
import { ReviewSuggestionsLink } from "@/components/activity/activity-attention";
import {
	activitySummaryOptions,
	openActivity,
} from "@/components/activity/activity-state";
import { runStage, runTitle } from "@/components/activity/activity-text";
import {
	AttentionWell,
	RunProgress,
} from "@/components/activity/activity-visuals";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const rowClassName =
	"flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/75";
const smallWell = "size-7 rounded-md [&>svg]:size-3.5";

/** The user's running work and what needs them, beside the organisation card while there is any. */
const ActivityCard = () => {
	const headingId = useId();
	const { data: summary } = useQuery(activitySummaryOptions());
	const running = summary?.running ?? [];
	const failures = summary?.attention.failures ?? 0;
	const { data: attention } = useQuery(
		orpc.activity.attention.queryOptions({
			input: (summary?.attention.suggestions ?? 0) > 0 ? {} : skipToken,
		}),
	);
	const suggestions = attention?.suggestions ?? [];

	if (running.length === 0 && failures === 0 && suggestions.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby={headingId}
			className="bg-card overflow-hidden rounded-3xl border shadow-xs"
		>
			<div className="bg-muted/40 flex items-center gap-2 border-b px-5 py-3">
				<h2 id={headingId} className="font-heading text-base font-semibold">
					{m.activity_title()}
				</h2>
				{running.length > 0 ? (
					<Loader2Icon
						aria-hidden="true"
						className="text-status-processing size-3.5 animate-spin"
					/>
				) : null}
				<button
					type="button"
					onClick={openActivity}
					className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/75 ml-auto rounded-sm text-xs outline-none focus-visible:ring-3"
				>
					{m.activity_show_all()}
				</button>
			</div>
			<div className="space-y-4 p-5">
				{running.map((run) => {
					const title = runTitle(run);
					const measured = run.kind !== "export" && run.progress.total > 0;
					return (
						<div key={run.id} className="space-y-1.5">
							<div className="flex items-baseline justify-between gap-2 text-sm">
								<span className="min-w-0 truncate font-medium" title={title}>
									{title}
								</span>
								{measured ? (
									<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
										{m.activity_progress_short({
											done: run.progress.done,
											total: run.progress.total,
										})}
									</span>
								) : null}
							</div>
							{measured ? <RunProgress run={run} label={title} /> : null}
							<p className="text-muted-foreground truncate text-xs">
								{[
									runStage(run),
									run.organization?.name,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						</div>
					);
				})}
				{suggestions.length > 0 || failures > 0 ? (
					<ul className={cn("-mx-2", running.length > 0 && "border-t pt-3")}>
						{suggestions.map((entry) => (
							<li key={entry.organization.id}>
								<ReviewSuggestionsLink
									organizationId={entry.organization.id}
									className={rowClassName}
								>
									<AttentionWell kind="suggestions" className={smallWell} />
									<span className="min-w-0 flex-1 truncate">
										{m.activity_suggestions_title({
											count: entry.count,
										})}
										<span className="text-muted-foreground">
											{` · ${entry.organization.name}`}
										</span>
									</span>
									<ChevronRightIcon
										aria-hidden="true"
										className="text-muted-foreground size-4"
									/>
								</ReviewSuggestionsLink>
							</li>
						))}
						{failures > 0 ? (
							<li>
								<button
									type="button"
									onClick={openActivity}
									className={rowClassName}
								>
									<AttentionWell kind="failure" className={smallWell} />
									<span className="min-w-0 flex-1 truncate">
										{m.activity_failures_count({
											count: failures,
										})}
									</span>
									<ChevronRightIcon
										aria-hidden="true"
										className="text-muted-foreground size-4"
									/>
								</button>
							</li>
						) : null}
					</ul>
				) : null}
			</div>
		</section>
	);
};

export { ActivityCard };
