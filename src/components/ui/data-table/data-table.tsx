import { useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	getCoreRowModel,
	getSortedRowModel,
	type PaginationState,
	type TableState,
	useReactTable,
} from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { TableProvider } from "./data-table-context";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	state: Partial<TableState>;
}

interface DataTableOptions<TData> {
	rowCount: number;
	uidAccessor: keyof TData;
	meta?: Record<string, unknown>;
	clientPagination?: PaginationState;
	clientSetPagination?: Dispatch<SetStateAction<PaginationState>>;
}

const DataTable = <TData, TValue>({
	children,
	columns,
	data,
	options,
	state,
	...divProps
}: DataTableProps<TData, TValue> & {
	options: DataTableOptions<TData>;
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
	const navigate = useNavigate();
	const { rowCount, uidAccessor, meta } = options;

	const table = useReactTable({
		data,
		meta,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
		rowCount: rowCount,
		onPaginationChange: async (updater) => {
			if (typeof updater !== "function") return;

			const newPageInfo = updater(table.getState().pagination);

			await navigate({
				to: ".",
				search: {
					pageIndex: newPageInfo.pageIndex,
					pageSize: newPageInfo.pageSize,
				},
			});
		},
		/* onSortingChange: (updater) => {
			// A bit awkward, but this satisfies typescript
			if (typeof updater === "function") {
				setSorting({ sort: updater(sorting.sort ?? []) });
			}
		}, */
		getSortedRowModel: getSortedRowModel(),
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
