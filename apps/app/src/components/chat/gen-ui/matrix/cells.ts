import type { Status } from "@/components/chat/gen-ui/status";
import {
	isRecord,
	listOf,
	statusOf,
	textOf,
} from "@/components/chat/gen-ui/streamed";

export type MatrixColumn = {
	key: string;
	label: string;
};

export type MatrixCell = {
	column: MatrixColumn;
	status?: Status;
	note?: string;
};

export type MatrixRow = {
	label?: string;
	/** In column order; keys not in `columns` are ignored. */
	cells: MatrixCell[];
};

/** Columns whose key has arrived; a partial label reads as empty. */
const columnOf = (value: unknown): MatrixColumn[] => {
	const key = isRecord(value) ? textOf(value.key) : undefined;
	return key && isRecord(value)
		? [
				{
					key,
					label: textOf(value.label) ?? "",
				},
			]
		: [];
};

const rowOf =
	(columns: readonly MatrixColumn[]) =>
	(value: unknown): MatrixRow[] => {
		if (!isRecord(value)) {
			return [];
		}
		const cells = isRecord(value.cells) ? value.cells : {};
		return [
			{
				label: textOf(value.label),
				cells: columns.map((column) => {
					const cell = Object.hasOwn(cells, column.key)
						? cells[column.key]
						: undefined;
					return {
						column,
						status: isRecord(cell) ? statusOf(cell.status) : undefined,
						note: isRecord(cell) ? textOf(cell.note) : undefined,
					};
				}),
			},
		];
	};

/** Partial or stored input, with malformed entries left out. */
export const matrixOf = (input: unknown) => {
	const matrix = isRecord(input) ? input : {};
	const columns = listOf(matrix.columns).flatMap(columnOf);
	return {
		title: textOf(matrix.title),
		columns,
		rows: listOf(matrix.rows).flatMap(rowOf(columns)),
	};
};

/** Notes worth showing: those on cells with a status other than met. */
export const rowNotes = (row: MatrixRow) =>
	row.cells.filter(
		(
			cell,
		): cell is MatrixCell & {
			status: Status;
			note: string;
		} =>
			Boolean(cell.note) && cell.status !== undefined && cell.status !== "met",
	);
