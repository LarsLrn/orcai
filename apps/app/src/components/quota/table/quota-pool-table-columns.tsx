import type { quotaPoolListRowSchema } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import type { z } from "zod/v4";
import {
	QuotaConsumption,
	QuotaRemaining,
} from "@/components/quota/quota-consumption";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLinkItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenuTrigger } from "@/components/ui/shell/actions";
import { useDeactivateQuotaPoolMutation } from "@/hooks/mutations/use-quota-mutations";
import { formatNumber } from "@/lib/presentation/format-number";
import {
	getQuotaPoolStatusLabel,
	getQuotaPoolStatusVariant,
} from "@/lib/presentation/quota-pool-status";
import { m } from "@/paraglide/messages";

type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;

const formatAmount = (value: number | null | undefined) => {
	return formatNumber(value, "-");
};

const formatPeriodType = (value: QuotaPoolListRow["periodType"]) => {
	switch (value) {
		case "weekly":
			return m.quotas_period_weekly_label();
		case "monthly":
			return m.quotas_period_monthly_label();
		case "yearly":
			return m.quotas_period_yearly_label();
		default:
			return value;
	}
};

const columnHelper = createColumnHelper<DataTableFeatures, QuotaPoolListRow>();

export const quotaPoolTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 320,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_table_pool_column_header()}
			/>
		),
		cell: ({ row }) => (
			<div className="min-w-0 space-y-1">
				<Link
					to="/app/quotas/$quotaPoolId"
					params={{
						quotaPoolId: row.original.id,
					}}
					className="truncate font-medium hover:underline"
				>
					{row.original.name}
				</Link>
				<div className="truncate text-muted-foreground text-xs">
					{row.original.provider.name}
				</div>
			</div>
		),
		meta: {
			label: m.quotas_table_pool_column_header,
		},
	}),
	columnHelper.accessor("periodType", {
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_table_period_column_header()}
			/>
		),
		cell: ({ row }) => formatPeriodType(row.original.periodType),
		meta: {
			label: m.quotas_table_period_column_header,
		},
	}),
	columnHelper.display({
		id: "budget",
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_table_budget_column_header()}
			/>
		),
		cell: ({ row }) => (
			<div className="text-right">
				{formatAmount(row.original.currentLedger?.budgetAmount)}
			</div>
		),
	}),
	columnHelper.display({
		id: "consumed",
		size: 200,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_table_consumed_column_header()}
			/>
		),
		cell: ({ row }) => (
			<QuotaConsumption
				consumedAmount={row.original.currentLedger?.consumedAmount}
				budgetAmount={row.original.currentLedger?.budgetAmount}
				unit={row.original.provider.meteringMode}
			/>
		),
	}),
	columnHelper.display({
		id: "remaining",
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.quotas_table_remaining_column_header()}
			/>
		),
		cell: ({ row }) => (
			<QuotaRemaining
				remainingAmount={row.original.currentLedger?.remainingAmount}
				budgetAmount={row.original.currentLedger?.budgetAmount}
				unit={row.original.provider.meteringMode}
			/>
		),
	}),
	columnHelper.display({
		id: "status",
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.common_status_column_header()}
			/>
		),
		cell: ({ row }) => (
			<div className="flex flex-wrap items-center gap-1">
				<Badge variant={getQuotaPoolStatusVariant(row.original.isActive)}>
					{getQuotaPoolStatusLabel(row.original.isActive)}
				</Badge>
				{row.original.isDefault ? (
					<Badge variant="outline">{m.quotas_table_default_badge()}</Badge>
				) : null}
			</div>
		),
	}),
	columnHelper.display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => (
			<DropdownMenu>
				<DropdownMenuTrigger render={<OverflowMenuTrigger variant="ghost" />} />
				<DropdownMenuContent align="end">
					<DropdownMenuLinkItem
						render={
							<Link
								to="/app/quotas/$quotaPoolId"
								params={{
									quotaPoolId: row.original.id,
								}}
							/>
						}
					>
						{m.quotas_table_view_menu_item()}
					</DropdownMenuLinkItem>
					<DropdownMenuLinkItem
						render={
							<Link
								to="/app/quotas/$quotaPoolId/edit"
								params={{
									quotaPoolId: row.original.id,
								}}
							/>
						}
					>
						{m.quotas_table_edit_menu_item()}
					</DropdownMenuLinkItem>
					<DropdownMenuSeparator />
					<DeactivateItem pool={row.original} />
				</DropdownMenuContent>
			</DropdownMenu>
		),
	}),
]);

const DeactivateItem = ({ pool }: { pool: QuotaPoolListRow }) => {
	const deactivatePool = useDeactivateQuotaPoolMutation({}, pool.name);

	return (
		<DropdownMenuItem
			variant="destructive"
			disabled={!pool.isActive}
			onClick={() =>
				deactivatePool.mutate({
					id: pool.id,
				})
			}
		>
			{m.quotas_table_deactivate_menu_item()}
		</DropdownMenuItem>
	);
};
