"use client";

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
