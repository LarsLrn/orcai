import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const DataTableToolbar = ({ className, ...props }: ComponentProps<"div">) => (
	<div
		className={cn(
			"flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
			className,
		)}
		{...props}
	/>
);

const DataTableToolbarActions = ({
	className,
	...props
}: ComponentProps<"div">) => (
	<div
		className={cn("flex items-center gap-2 sm:ml-auto", className)}
		{...props}
	/>
);

export { DataTableToolbar, DataTableToolbarActions };
