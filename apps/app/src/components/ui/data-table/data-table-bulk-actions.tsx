import type { ReactTable, Row, RowData } from "@tanstack/react-table";
import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTable } from "./data-table-context";
import type { DataTableFeatures } from "./data-table-features";

type DataTableBulkActionContext<TData extends RowData> = {
	selectedRows: Row<DataTableFeatures, TData>[];
	table: ReactTable<DataTableFeatures, TData>;
};

type DataTableBulkAction<TData extends RowData> = {
	label: string;
	variant?: "default" | "destructive";
	disabled?:
		| boolean
		| ((context: DataTableBulkActionContext<TData>) => boolean);
	onSelect: (context: DataTableBulkActionContext<TData>) => void;
};

type DataTableBulkActionsProps<TData extends RowData> = {
	actions: DataTableBulkAction<TData>[];
	isPending?: boolean;
};

const resolveDisabled = <TData extends RowData>(
	action: DataTableBulkAction<TData>,
	context: DataTableBulkActionContext<TData>,
) => {
	if (typeof action.disabled === "function") {
		return action.disabled(context);
	}

	return action.disabled ?? false;
};

const DataTableBulkActions = <TData extends RowData>({
	actions,
	isPending,
}: DataTableBulkActionsProps<TData>) => {
	const { table } = useTable<TData>();
	const selectedRows = table.getSelectedRowModel().rows;
	const selectedCount = selectedRows.length;
	const context: DataTableBulkActionContext<TData> = {
		selectedRows,
		table,
	};
	const isVisible = selectedCount > 0 && actions.length > 0;

	return (
		<div className="flex min-w-36 items-center justify-end gap-2">
			{isVisible && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="outline"
								size="sm"
								className="h-8"
								disabled={isPending}
								aria-label="Bulk actions"
							>
								<ReplaceAllIcon />
								{selectedCount} selected
							</Button>
						}
					/>
					<DropdownMenuContent align="end" className="w-50">
						{actions.map((action) => (
							<DropdownMenuItem
								key={action.label}
								variant={action.variant}
								disabled={isPending || resolveDisabled(action, context)}
								onClick={() => action.onSelect(context)}
							>
								{action.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
};

export type { DataTableBulkAction };
export { DataTableBulkActions };
