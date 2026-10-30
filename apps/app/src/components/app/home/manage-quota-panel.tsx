import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	QuotaConsumption,
	QuotaRemaining,
} from "@/components/quota/quota-consumption";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Panel,
	PanelHeader,
	PanelNote,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const POOL_LIMIT = 3;

/** Why no active pool shows: none exists yet, or every pool is inactive. */
const NoActivePoolNote = () => {
	const { data: pools } = useSuspenseQuery(
		orpc.quota.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 1,
			},
		}),
	);

	return (
		<PanelNote>
			{pools.rowCount === 0
				? m.home_quota_panel_empty_note()
				: m.home_quota_panel_none_active_note()}
		</PanelNote>
	);
};

/** Active quota pools with what is left in the open period, for people who manage quotas. */
const ManageQuotaPanel = () => {
	const { data: pools } = useSuspenseQuery(
		orpc.quota.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: POOL_LIMIT,
				filters: {
					isActive: true,
				},
				sort: [
					{
						id: "priority",
						desc: true,
					},
				],
			},
		}),
	);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{m.home_quota_panel_title()}</PanelTitle>
				<Link
					to="/app/quotas"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
					})}
				>
					{m.home_quota_panel_all_pools_action()}
				</Link>
			</PanelHeader>
			{pools.data.length === 0 ? (
				<NoActivePoolNote />
			) : (
				<PanelRows>
					{pools.data.map((pool) => (
						<Link
							key={pool.id}
							to="/app/quotas/$quotaPoolId"
							params={{
								quotaPoolId: pool.id,
							}}
							className={panelRowVariants({
								variant: "link",
							})}
						>
							<div className="flex min-w-0 flex-col gap-1">
								<div className="flex items-center gap-2">
									<span className="truncate font-medium">{pool.name}</span>
									{pool.isDefault ? (
										<Badge variant="brand">
											{m.home_quota_pool_default_badge()}
										</Badge>
									) : null}
								</div>
								<p className="truncate text-muted-foreground text-xs">
									{pool.currentPeriod
										? m.home_quota_pool_meta_renews({
												provider: pool.provider.name,
												date: formatDisplayDate(pool.currentPeriod.endsAt),
											})
										: m.home_quota_pool_meta_no_period({
												provider: pool.provider.name,
											})}
								</p>
							</div>
							<div className="flex shrink-0 flex-col items-end gap-1">
								<QuotaRemaining
									remainingAmount={pool.currentLedger?.remainingAmount}
									budgetAmount={pool.currentLedger?.budgetAmount}
									unit={pool.provider.meteringMode}
								/>
								<QuotaConsumption
									consumedAmount={pool.currentLedger?.consumedAmount}
									budgetAmount={pool.currentLedger?.budgetAmount}
									unit={pool.provider.meteringMode}
									className="text-muted-foreground text-xs"
								/>
							</div>
						</Link>
					))}
				</PanelRows>
			)}
		</Panel>
	);
};

export { ManageQuotaPanel };
