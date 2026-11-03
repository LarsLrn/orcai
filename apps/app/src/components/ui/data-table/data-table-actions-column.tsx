import { createColumnHelper, type RowData } from "@tanstack/react-table";
import type * as React from "react";
import { ActionMenu, type HeaderAction } from "@/components/ui/shell/actions";
import type { DataTableFeatures } from "./data-table-features";

type RowActions = {
	/** Falsy entries are left out, so capability checks can sit inline. */
	actions: (HeaderAction | false | null | undefined)[];
	/** The dialogs the actions open. */
	dialog?: React.ReactNode;
};

type UseRowActions<TData> = (row: TData) => RowActions;

const RowActionMenu = <TData,>({
	row,
	useRowActions,
}: {
	row: TData;
	useRowActions: UseRowActions<TData>;
}) => {
	const { actions, dialog } = useRowActions(row);
	const declared = actions.filter((action): action is HeaderAction =>
		Boolean(action),
	);

	return (
		<>
			{declared.length > 0 ? (
				<ActionMenu actions={declared} triggerVariant="ghost" />
			) : null}
			{dialog}
		</>
	);
};

/** A row's `…` menu of the actions `useRowActions` offers for it, the destructive ones below a separator. */
export const createDataTableActionsColumn = <TData extends RowData>(
	useRowActions: UseRowActions<TData>,
) =>
	createColumnHelper<DataTableFeatures, TData>().display({
		id: "actions",
		size: 32,
		enableSorting: false,
		enableHiding: false,
		cell: ({ row }) => (
			<RowActionMenu row={row.original} useRowActions={useRowActions} />
		),
	});
