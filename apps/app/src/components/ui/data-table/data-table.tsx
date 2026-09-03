import { useNavigate } from "@tanstack/react-router";
import {
	functionalUpdate,
	type Row,
	type RowData,
	type TableState,
	useTable,
} from "@tanstack/react-table";
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
	uidAccessor: keyof TData;
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
		getRowId: (row) => String(row[uidAccessor]),
	});

	return (
		<TableProvider table={table}>
			<div {...divProps} className={cn("space-y-4", divProps.className)}>
				{children}
			</div>
		</TableProvider>
	);
};

export { DataTable };
