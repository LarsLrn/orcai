import {
	type ColumnDef,
	columnSizingFeature,
	columnVisibilityFeature,
	metaHelper,
	type RowData,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	tableFeatures,
} from "@tanstack/react-table";

type DataTableColumnMeta = {
	/** Column name for the view options and the CSV export, read per render. */
	label?: () => string;
};

export const dataTableFeatures = tableFeatures({
	columnSizingFeature,
	columnVisibilityFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
	DataTableFeatures,
	TData
>;
