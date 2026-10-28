import { Pager } from "@/components/ui/pager";
import { m } from "@/paraglide/messages";
import { useTable } from "./data-table-context";

const DataTablePagination = () => {
	const { table } = useTable();

	const hasSelectionColumn = table
		.getAllLeafColumns()
		.some((column) => column.id === "select");

	if (table.getRowModel().rows.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-2">
			<div className="grow whitespace-nowrap text-muted-foreground text-sm">
				{hasSelectionColumn
					? m.data_table_pagination_selected_rows({
							selected: table.getFilteredSelectedRowModel().rows.length,
							total: table.getRowModel().rows.length,
						})
					: null}
			</div>
			<Pager
				pageIndex={table.state.pagination.pageIndex}
				pageSize={table.state.pagination.pageSize}
				pageCount={table.getPageCount()}
				onPageIndexChange={(pageIndex) => table.setPageIndex(pageIndex)}
				onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
			/>
		</div>
	);
};

export { DataTablePagination };
