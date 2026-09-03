import type { VariantProps } from "class-variance-authority";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTable } from "./data-table-context";
import { buildCsvRows, csvFileName, toCsv } from "./data-table-csv";

const downloadCsv = (fileName: string, csv: string) => {
	const blob = new Blob(
		[
			csv,
		],
		{
			type: "text/csv;charset=utf-8",
		},
	);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = csvFileName(fileName);
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

const DataTableExportButton = ({
	fileName,
	className,
	variant = "outline",
	size = "sm",
	children,
	...props
}: {
	fileName: string;
} & ComponentProps<"button"> &
	VariantProps<typeof buttonVariants>) => {
	const { table } = useTable();

	return (
		<Button
			variant={variant}
			size={size}
			className={cn(className, "h-8")}
			onClick={() => downloadCsv(fileName, toCsv(buildCsvRows(table)))}
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
