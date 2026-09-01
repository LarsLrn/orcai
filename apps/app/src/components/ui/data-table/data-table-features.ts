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
	/** Column label used by the CSV export. Falls back to the column id. */
	exportLabel?: string;
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
