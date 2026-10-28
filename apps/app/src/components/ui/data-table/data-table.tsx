import { useNavigate } from "@tanstack/react-router";
import {
	functionalUpdate,
	type Row,
	type RowData,
	type TableState,
	useTable,
} from "@tanstack/react-table";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { TableProvider } from "./data-table-context";
import {
	type DataTableColumnDef,
	type DataTableFeatures,
	dataTableFeatures,
} from "./data-table-features";
import { withPagination, withSorting } from "./data-table-search-params";

interface DataTableProps<TData extends RowData> {
	columns: DataTableColumnDef<TData>[];
	data: TData[];
	state: Partial<TableState<DataTableFeatures>>;
}

interface DataTableOptions<TData extends RowData> {
	rowCount: number;
	/** The row's key, or a function deriving it when no single field holds one. */
	uidAccessor: keyof TData | ((row: TData) => string);
	enableRowSelection?:
		| boolean
		| ((row: Row<DataTableFeatures, TData>) => boolean);
}

const DataTable = <TData extends RowData>({
	children,
	columns,
	data,
	options,
	state,
	...divProps
}: DataTableProps<TData> & {
	options: DataTableOptions<TData>;
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
	const navigate = useNavigate();
	const { rowCount, uidAccessor } = options;

	const table = useTable({
		features: dataTableFeatures,
		data,
		columns,
		manualPagination: true,
		manualSorting: true,
		rowCount,
		enableRowSelection: options.enableRowSelection,
		onPaginationChange: (updater) => {
			const pagination = functionalUpdate(updater, table.state.pagination);
			table.resetRowSelection();

			void navigate({
				to: ".",
				search: (prev) => withPagination(prev, pagination),
			});
		},
		onSortingChange: (updater) => {
			const sorting = functionalUpdate(updater, table.state.sorting);
			table.resetRowSelection();

			void navigate({
				to: ".",
				search: (prev) => withSorting(prev, sorting as typeof prev.sort),
			});
		},
		state,
		getRowId: (row) =>
			typeof uidAccessor === "function"
				? uidAccessor(row)
				: String(row[uidAccessor]),
	});

	// A page emptied by deletions moves back to the last page, keeping filters.
	const { pageIndex, pageSize } = table.state.pagination;
	const lastPageIndex = Math.max(0, Math.ceil(rowCount / pageSize) - 1);
	useEffect(() => {
		if (data.length > 0 || pageIndex <= lastPageIndex) return;
		void navigate({
			to: ".",
			search: (prev) =>
				withPagination(prev, {
					pageIndex: lastPageIndex,
					pageSize,
				}),
			replace: true,
		});
	}, [
		data.length,
		lastPageIndex,
		navigate,
		pageIndex,
		pageSize,
	]);

	return (
		<TableProvider table={table}>
			<div {...divProps} className={cn("space-y-4", divProps.className)}>
				{children}
			</div>
		</TableProvider>
	);
};

export { DataTable };
