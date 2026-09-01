import { createColumnHelper, type RowData } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { DataTableFeatures } from "./data-table-features";

export const createDataTableSelectColumn = <TData extends RowData>() =>
	createColumnHelper<DataTableFeatures, TData>().display({
		id: "select",
		size: 32,
		header: ({ table }) => {
			const hasSelectableRows = table
				.getRowModel()
				.rows.some((row) => row.getCanSelect());
			const allSelected = table.getIsAllPageRowsSelected();

			return (
				<Checkbox
					checked={allSelected}
					disabled={!hasSelectableRows}
					indeterminate={table.getIsSomePageRowsSelected() && !allSelected}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all rows on this page"
				/>
			);
		},
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				disabled={!row.getCanSelect()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	});
