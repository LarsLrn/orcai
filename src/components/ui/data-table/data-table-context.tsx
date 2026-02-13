"use no memo";
// FIXME: tanstack table is incompatible with the react compiler. Monitor the repo for any updates: https://github.com/TanStack/table/issues/5567

import type { Table } from "@tanstack/react-table";
import { createContext, useContext } from "react";

const TableContext = createContext<{ table: Table<any> } | null>(null);

export const useTable = () => {
	const context = useContext(TableContext);
	if (!context) {
		throw new Error("useTable must be used within a TableProvider");
	}
	return context;
};

const TableProvider: React.FC<{
	children: React.ReactNode;
	table: Table<any>;
}> = ({ table, children }) => (
	<TableContext.Provider value={{ table }}>{children}</TableContext.Provider>
);

export { TableProvider };
