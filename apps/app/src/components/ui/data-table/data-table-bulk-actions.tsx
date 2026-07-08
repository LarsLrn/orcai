import type { Row, Table } from "@tanstack/react-table";
import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTable } from "./data-table-context";

type DataTableBulkActionContext<TData> = {
	selectedRows: Row<TData>[];
	table: Table<TData>;
};

type DataTableBulkAction<TData> = {
	label: string;
	variant?: "default" | "destructive";
	disabled?:
		| boolean
		| ((context: DataTableBulkActionContext<TData>) => boolean);
	onSelect: (context: DataTableBulkActionContext<TData>) => void;
};

type DataTableBulkActionsProps<TData> = {
	actions: DataTableBulkAction<TData>[];
	isPending?: boolean;
};

const resolveDisabled = <TData,>(
	action: DataTableBulkAction<TData>,
	context: DataTableBulkActionContext<TData>,
) => {
	if (typeof action.disabled === "function") {
		return action.disabled(context);
	}

	return action.disabled ?? false;
};

const DataTableBulkActions = <TData,>({
	actions,
	isPending,
}: DataTableBulkActionsProps<TData>) => {
	const { table } = useTable();
	const selectedRows = table.getSelectedRowModel().rows as Row<TData>[];
	const selectedCount = selectedRows.length;
	const context = {
		selectedRows,
		table: table as Table<TData>,
	};
	const hasSelection = selectedCount > 0;

	if (actions.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="outline"
							size="sm"
							className="h-8"
							disabled={!hasSelection || isPending}
						>
							<ReplaceAllIcon />
							Actions
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-50">
					{actions.map((action) => (
						<DropdownMenuItem
							key={action.label}
							variant={action.variant}
							disabled={
								!hasSelection || isPending || resolveDisabled(action, context)
							}
							onClick={() => action.onSelect(context)}
						>
							{action.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};

export type { DataTableBulkAction };
export { DataTableBulkActions };
