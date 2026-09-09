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

const POOL_LIMIT = 3;

/** Active quota pools with what is left in the open period. */
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
				<PanelTitle>Quota</PanelTitle>
				<Link
					to="/app/quotas"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
					})}
				>
					All pools
				</Link>
			</PanelHeader>
			{pools.data.length === 0 ? (
				<PanelNote>
					No quota pools yet. Chats use the provider's own limits until one
					exists.
				</PanelNote>
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
										<Badge variant="brand">Default</Badge>
									) : null}
								</div>
								<p className="truncate text-muted-foreground text-xs">
									{pool.provider.name}
									{pool.currentPeriod
										? `, renews ${formatDisplayDate(pool.currentPeriod.endsAt)}`
										: ", no open period"}
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
