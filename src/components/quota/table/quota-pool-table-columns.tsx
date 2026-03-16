import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import type { z } from "zod/v4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeactivateQuotaPoolMutation } from "@/hooks/mutations/use-quota-mutations";
import type { quotaPoolListRowSchema } from "@/lib/orpc/schemas/quota";

type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;

const numberFormatter = new Intl.NumberFormat();

const formatAmount = (value: number | null | undefined) => {
	if (value === null || value === undefined) {
		return "-";
	}

	return numberFormatter.format(value);
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

export const quotaPoolTableColumns: ColumnDef<QuotaPoolListRow>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={table.getIsSomePageRowsSelected()}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		id: "name",
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
	},
	{
		accessorKey: "periodType",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Period" />
		),
		cell: ({ row }) => formatPeriodType(row.original.periodType),
	},
	{
		id: "budget",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Budget" />
		),
		cell: ({ row }) => (
			<div className="text-right">
				{formatAmount(row.original.currentLedger?.budgetAmount)}
			</div>
		),
	},
	{
		id: "consumed",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Consumed" />
		),
		cell: ({ row }) => (
			<div className="text-right">
				{formatAmount(row.original.currentLedger?.consumedAmount)}
			</div>
		),
	},
	{
		id: "remaining",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Remaining" />
		),
		cell: ({ row }) => (
			<div className="text-right font-medium">
				{formatAmount(row.original.currentLedger?.remainingAmount)}
			</div>
		),
	},
	{
		id: "status",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Status" />
		),
		cell: ({ row }) => (
			<div className="flex flex-wrap items-center gap-1">
				<Badge variant={row.original.isActive ? "default" : "secondary"}>
					{row.original.isActive ? "Active" : "Inactive"}
				</Badge>
				{row.original.isDefault ? (
					<Badge variant="outline">Default</Badge>
				) : null}
			</div>
		),
	},
	{
		id: "actions",
		size: 32,
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
						<DropdownMenuItem>View Pool</DropdownMenuItem>
					</Link>
					<Link
						to="/app/quotas/$quotaPoolId/edit"
						params={{
							quotaPoolId: row.original.id,
						}}
					>
						<DropdownMenuItem>Edit Pool</DropdownMenuItem>
					</Link>
					<DropdownMenuSeparator />
					<DeactivateItem pool={row.original} />
				</DropdownMenuContent>
			</DropdownMenu>
		),
	},
];

const DeactivateItem = ({ pool }: { pool: QuotaPoolListRow }) => {
	const deactivatePool = useDeactivateQuotaPoolMutation();

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
			Deactivate Pool
		</DropdownMenuItem>
	);
};
