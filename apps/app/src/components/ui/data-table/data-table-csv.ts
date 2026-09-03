import type { ReactTable, RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./data-table-features";

const CSV_LINE_BREAK = "\r\n";

export const escapeCsvField = (field: string): string =>
	/[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;

export const toCsv = (rows: readonly (readonly string[])[]): string =>
	rows.map((row) => row.map(escapeCsvField).join(",")).join(CSV_LINE_BREAK) +
	CSV_LINE_BREAK;

export const formatCsvValue = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

export const buildCsvRows = <TData extends RowData>(
	table: ReactTable<DataTableFeatures, TData>,
): string[][] => {
	const columns = table
		.getVisibleLeafColumns()
		.filter((column) => column.accessorFn !== undefined);

	const header = columns.map(
		(column) => column.columnDef.meta?.exportLabel ?? column.id,
	);
	const body = table
		.getCoreRowModel()
		.rows.map((row) =>
			columns.map((column) => formatCsvValue(row.getValue(column.id))),
		);

	return [
		header,
		...body,
	];
};

export const csvFileName = (fileName: string): string =>
	fileName.toLowerCase().endsWith(".csv") ? fileName : `${fileName}.csv`;
