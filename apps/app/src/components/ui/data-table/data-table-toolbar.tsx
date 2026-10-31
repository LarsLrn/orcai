import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { DataTableViewOptions } from "./data-table-view-options";

const DataTableToolbar = ({ className, ...props }: ComponentProps<"div">) => (
	<div
		className={cn("flex flex-wrap items-center gap-2", className)}
		{...props}
	/>
);

/** The table's actions, closed by the column options at the right edge. */
const DataTableToolbarActions = ({
	className,
	children,
	...props
}: ComponentProps<"div">) => (
	<div className={cn("ml-auto flex items-center gap-2", className)} {...props}>
		{children}
		<DataTableViewOptions />
	</div>
);

export { DataTableToolbar, DataTableToolbarActions };
