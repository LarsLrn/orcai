import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-x-8">
				<div className="flex items-center space-x-2">
					<p className="whitespace-nowrap font-medium text-sm">
						{m.data_table_pagination_rows_per_page_label()}
					</p>
					<Select
						value={`${table.state.pagination.pageSize}`}
						onValueChange={(value) => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger className="h-8 w-20">
							<SelectValue>
								{table.state.pagination.pageSize.toString()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent side="top">
							{[
								20,
								30,
								50,
								100,
								200,
							].map((pageSize) => (
								<SelectItem key={pageSize} value={`${pageSize}`}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center space-x-2">
					<div className="flex w-25 items-center justify-center font-medium text-sm">
						{m.data_table_pagination_position({
							page: table.state.pagination.pageIndex + 1,
							pageCount: table.getPageCount(),
						})}
					</div>
					<Button
						variant="outline"
						className="hidden h-8 w-8 p-0 lg:flex"
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">
							{m.common_pagination_first_page_label()}
						</span>
						<ChevronsLeft />
					</Button>
					<Button
						variant="outline"
						className="h-8 w-8 p-0"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">
							{m.common_pagination_previous_page_label()}
						</span>
						<ChevronLeft />
					</Button>
					<Button
						variant="outline"
						className="h-8 w-8 p-0"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">
							{m.common_pagination_next_page_label()}
						</span>
						<ChevronRight />
					</Button>
					<Button
						variant="outline"
						className="hidden h-8 w-8 p-0 lg:flex"
						onClick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">
							{m.common_pagination_last_page_label()}
						</span>
						<ChevronsRight />
					</Button>
				</div>
			</div>
		</div>
	);
};

export { DataTablePagination };
