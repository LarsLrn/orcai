import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	formatCompactNumber,
	formatPercent,
} from "@/lib/presentation/format-number";
import {
	formatDisplayTimestamp,
	formatRelativeTime,
} from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { UsageView } from "./usage-view";

const barClassName = "gap-0 **:data-[slot=progress-track]:h-1.5";

const ContextSection = ({
	context,
}: {
	context: NonNullable<UsageView["context"]>;
}) => (
	<section className="flex flex-col gap-1.5">
		<div className="flex items-baseline justify-between gap-3">
			<h3 className="font-medium">{m.chat_usage_context_title()}</h3>
			{context.modelName && (
				<span className="min-w-0 truncate text-muted-foreground text-xs">
					{context.modelName}
				</span>
			)}
		</div>
		{context.share !== undefined && context.window !== undefined ? (
			<>
				<div className="flex items-baseline justify-between gap-3 text-xs">
					<span>
						{m.chat_usage_share_used({
							percent: formatPercent(context.share),
						})}
					</span>
					<span className="text-muted-foreground tabular-nums">
						{m.chat_usage_context_tokens_of_window({
							tokens: formatCompactNumber(context.tokens),
							window: formatCompactNumber(context.window),
						})}
					</span>
				</div>
				<Progress
					value={Math.min(context.share, 1) * 100}
					aria-label={m.chat_usage_context_title()}
					className={barClassName}
				/>
			</>
		) : (
			<p className="text-muted-foreground text-xs tabular-nums">
				{m.chat_usage_context_tokens({
					tokens: formatCompactNumber(context.tokens),
				})}
			</p>
		)}
		{context.overflowing && (
			<p className="text-status-warning text-xs">
				{m.chat_usage_context_overflow_hint()}
			</p>
		)}
	</section>
);

const PoolSection = ({
	pool,
	managePool,
}: {
	pool: NonNullable<UsageView["pool"]>;
	managePool?: ReactNode;
}) => (
	<section
		data-low={pool.low || undefined}
		className="group/pool flex flex-col gap-1.5"
	>
		<h3 className="min-w-0 truncate font-medium group-data-low/pool:text-status-warning">
			{pool.name}
		</h3>
		<Progress
			value={pool.usedShare * 100}
			aria-label={pool.name}
			className={cn(
				barClassName,
				pool.low && "**:data-[slot=progress-indicator]:bg-status-warning",
			)}
		/>
		<Tooltip>
			<TooltipTrigger
				render={
					<p className="w-fit text-muted-foreground text-xs group-data-low/pool:text-status-warning" />
				}
			>
				{m.chat_usage_pool_share({
					percent: formatPercent(pool.usedShare),
					time: formatRelativeTime(pool.periodEndsAt, {
						style: "narrow",
					}),
				})}
			</TooltipTrigger>
			<TooltipContent>
				{formatDisplayTimestamp(pool.periodEndsAt)}
			</TooltipContent>
		</Tooltip>
		{managePool}
	</section>
);

/** The usage popover's and drawer's content: context, then the pool. */
const UsageBody = ({
	view,
	managePool,
}: {
	view: UsageView;
	/** A link to the pool for people who manage quotas. */
	managePool?: ReactNode;
}) => (
	<div className="flex flex-col gap-3 text-sm">
		{view.context && <ContextSection context={view.context} />}
		{view.context && view.pool && <Separator />}
		{view.pool && <PoolSection pool={view.pool} managePool={managePool} />}
	</div>
);

export { UsageBody };
