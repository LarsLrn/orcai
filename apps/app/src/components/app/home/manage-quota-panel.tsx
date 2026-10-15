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
	PanelRow,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

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

	const { data: organizationCapabilities } = useOrganizationCapabilities();
	const canManageQuotas = hasCapability(
		organizationCapabilities?.data.capabilities,
		"manage_quotas",
	);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{m.home_quota_panel_title()}</PanelTitle>
				{canManageQuotas ? (
					<Link
						to="/app/quotas"
						className={buttonVariants({
							variant: "ghost",
							size: "sm",
						})}
					>
						{m.home_quota_panel_all_pools_action()}
					</Link>
				) : null}
			</PanelHeader>
			{pools.data.length === 0 ? (
				<PanelNote>{m.home_quota_panel_empty_note()}</PanelNote>
			) : (
				<PanelRows>
					{pools.data.map((pool) => {
						const body = (
							<>
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
							</>
						);

						return canManageQuotas ? (
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
								{body}
							</Link>
						) : (
							<PanelRow key={pool.id}>{body}</PanelRow>
						);
					})}
				</PanelRows>
			)}
		</Panel>
	);
};

export { ManageQuotaPanel };
