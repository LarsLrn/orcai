import { useNavigate } from "@tanstack/react-router";
import { FilterXIcon, SearchXIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { m } from "@/paraglide/messages";
import { useTable } from "./data-table-context";

/**
 * `empty` is what the page shows before anything exists. `filters` holds the
 * page's active search params, so an empty page under a filter, or past the
 * last page, offers to clear them instead.
 */
const DataTableBody = ({
	empty,
	filters = {},
}: {
	empty: React.ComponentProps<typeof Placeholder>;
	filters?: Record<string, unknown>;
}) => {
	const navigate = useNavigate();
	const { table } = useTable();
	const rows = table.getRowModel().rows;

	if (rows.length === 0) {
		const isFiltered =
			Object.values(filters).some(
				(value) => value !== undefined && value !== "",
			) || table.getRowCount() > 0;

		return isFiltered ? (
			<Placeholder
				Icon={SearchXIcon}
				title={m.data_table_filtered_empty_title()}
				description={m.data_table_filtered_empty_description()}
				actions={[
					{
						key: "clear",
						label: m.data_table_clear_filters_action(),
						icon: FilterXIcon,
						onClick: () =>
							void navigate({
								to: ".",
								search: (prev) => ({
									...prev,
									...Object.fromEntries(
										Object.keys(filters).map((key) => [
											key,
											undefined,
										]),
									),
									pageIndex: 0,
								}),
							}),
					},
				]}
			/>
		) : (
			<Placeholder {...empty} />
		);
	}

	return (
		<div className="overflow-hidden rounded-2xl border bg-card">
			<Table className="[&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th:first-child]:ps-5 [&_th:last-child]:pe-5">
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
									{header.isPlaceholder ? null : (
										<table.FlexRender header={header} />
									)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow
							key={row.id}
							data-state={row.getIsSelected() && "selected"}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell
									key={cell.id}
									style={{
										width: cell.column.getSize(),
									}}
								>
									<table.FlexRender cell={cell} />
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
};

export { DataTableBody };
