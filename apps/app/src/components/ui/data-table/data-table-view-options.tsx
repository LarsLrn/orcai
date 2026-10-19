import { Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages";
import { useTable } from "./data-table-context";

const DataTableViewOptions = () => {
	const { table } = useTable();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="h-8">
						<Settings2Icon />
						{m.data_table_view_options_trigger()}
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-37.5">
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						{m.data_table_view_options_title()}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{table
						.getAllColumns()
						.filter(
							(column) =>
								typeof column.accessorFn !== "undefined" && column.getCanHide(),
						)
						.map((column) => {
							return (
								<DropdownMenuCheckboxItem
									key={column.columnDef.meta?.label?.() ?? column.id}
									checked={column.getIsVisible()}
									onCheckedChange={(value) => column.toggleVisibility(!!value)}
								>
									{column.columnDef.meta?.label?.() ?? column.id}
								</DropdownMenuCheckboxItem>
							);
						})}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { DataTableViewOptions };
