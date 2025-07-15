"use client";

import type { VariantProps } from "class-variance-authority";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import exportToCsv from "tanstack-table-export-to-csv";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTable } from "./data-table-context";

const DataTableExportButton = ({
	fileName,
	className,
	variant = "outline",
	size = "sm",
	children,
	...props
}: { fileName: string } & ComponentProps<"button"> &
	VariantProps<typeof buttonVariants>) => {
	const { table } = useTable();

	if (!table) return null;

	const handleExportToCsv = (): void => {
		const headers = table.getHeaderGroups().flatMap((x) => x.headers);
		const rows = table.getCoreRowModel().rows;

		exportToCsv(fileName, headers, rows);
	};

	return (
		<Button
			variant={variant}
			size={size}
			className={cn(className, "h-8")}
			onClick={handleExportToCsv}
			{...props}
		>
			{children ?? (
				<>
					<DownloadIcon /> Download
				</>
			)}
		</Button>
	);
};

export { DataTableExportButton };
