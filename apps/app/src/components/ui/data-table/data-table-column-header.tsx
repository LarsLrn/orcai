import { useSelector } from "@tanstack/react-store";
import type { Column, RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DataTableFeatures } from "./data-table-features";

interface DataTableColumnHeaderProps<TData extends RowData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<DataTableFeatures, TData, TValue>;
	title: string;
}

const DataTableColumnHeader = <TData extends RowData, TValue>({
	column,
	title,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) => {
	// Column objects stay stable; subscribe to the value the compiler must track.
	const sorting = useSelector(column.table.atoms.sorting, (state) =>
		state.find((sort) => sort.id === column.id),
	);

	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<div className={cn("flex items-center space-x-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="sm"
							className="-ml-3 h-8 w-full justify-start focus-visible:ring-transparent data-[state=open]:bg-accent"
						>
							<span>{title}</span>
							{sorting?.desc === true ? (
								<ArrowDown />
							) : sorting?.desc === false ? (
								<ArrowUp />
							) : (
								<ChevronsUpDown />
							)}
						</Button>
					}
				/>
				<DropdownMenuContent align="start">
					<DropdownMenuItem onClick={() => column.toggleSorting(false)}>
						<ArrowUp className="h-3.5 w-3.5 text-muted-foreground/70" />
						Asc
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => column.toggleSorting(true)}>
						<ArrowDown className="h-3.5 w-3.5 text-muted-foreground/70" />
						Desc
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
						<EyeOff className="h-3.5 w-3.5 text-muted-foreground/70" />
						Hide
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};

export { DataTableColumnHeader };
