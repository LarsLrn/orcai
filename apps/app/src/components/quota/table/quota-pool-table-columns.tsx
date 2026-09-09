import type { quotaPoolListRowSchema } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import type { z } from "zod/v4";
import {
	QuotaConsumption,
	QuotaRemaining,
} from "@/components/quota/quota-consumption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeactivateQuotaPoolMutation } from "@/hooks/mutations/use-quota-mutations";
import { formatNumber } from "@/lib/presentation/format-number";

type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;

const formatAmount = (value: number | null | undefined) => {
	return formatNumber(value, "-");
};

const formatPeriodType = (value: QuotaPoolListRow["periodType"]) => {
	switch (value) {
		case "weekly":
			return "Weekly";
		case "monthly":
			return "Monthly";
		case "yearly":
			return "Yearly";
		default:
			return value;
	}
};

const columnHelper = createColumnHelper<DataTableFeatures, QuotaPoolListRow>();

export const quotaPoolTableColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		size: 320,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Pool" />
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
	}),
	columnHelper.accessor("periodType", {
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Period" />
		),
		cell: ({ row }) => formatPeriodType(row.original.periodType),
	}),
	columnHelper.display({
		id: "budget",
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Budget" />
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
			<DataTableColumnHeader column={column} title="Consumed" />
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
			<DataTableColumnHeader column={column} title="Remaining" />
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
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<div className="flex flex-wrap items-center gap-1">
				<Badge variant={row.original.isActive ? "success" : "secondary"}>
					{row.original.isActive ? "Active" : "Inactive"}
				</Badge>
				{row.original.isDefault ? (
					<Badge variant="outline">Default</Badge>
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
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" className="size-8 p-0">
							<span className="sr-only">Open menu</span>
							<MoreHorizontal className="size-4" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<Link
						to="/app/quotas/$quotaPoolId"
						params={{
							quotaPoolId: row.original.id,
						}}
					>
						<DropdownMenuItem>View pool</DropdownMenuItem>
					</Link>
					<Link
						to="/app/quotas/$quotaPoolId/edit"
						params={{
							quotaPoolId: row.original.id,
						}}
					>
						<DropdownMenuItem>Edit pool</DropdownMenuItem>
					</Link>
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
			Deactivate pool
		</DropdownMenuItem>
	);
};
