import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";

export const createDataTableSelectColumn = <TData,>(): ColumnDef<TData> => ({
	id: "select",
	size: 32,
	header: ({ table }) => {
		const hasSelectableRows = table
			.getRowModel()
			.rows.some((row) => row.getCanSelect());

		return (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				disabled={!hasSelectableRows}
				indeterminate={table.getIsSomePageRowsSelected()}
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
