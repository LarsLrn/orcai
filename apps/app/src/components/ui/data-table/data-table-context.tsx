import type { ReactTable, RowData } from "@tanstack/react-table";
import { createContext, useContext } from "react";
import type { DataTableFeatures } from "./data-table-features";

type DataTableInstance<TData extends RowData> = ReactTable<
	DataTableFeatures,
	TData
>;

const TableContext = createContext<DataTableInstance<RowData> | null>(null);

export const useTable = <TData extends RowData = RowData>() => {
	const table = useContext(TableContext);
	if (!table) {
		throw new Error("useTable must be used within a TableProvider");
	}
	return {
		table: table as unknown as DataTableInstance<TData>,
	};
};

const TableProvider = <TData extends RowData>({
	table,
	children,
}: {
	children: React.ReactNode;
	table: DataTableInstance<TData>;
}) => (
	<TableContext.Provider value={table as unknown as DataTableInstance<RowData>}>
		{children}
	</TableContext.Provider>
);

export { TableProvider };
