import {
	type MatrixView,
	rowNotes,
} from "@/components/chat/gen-ui/matrix/cells";
import { statusLabel } from "@/components/chat/gen-ui/status";

const tableCell = (text: string) =>
	text.replaceAll("|", "\\|").replaceAll("\n", " ");

const tableRow = (cells: readonly string[]) =>
	`| ${cells.map(tableCell).join(" | ")} |`;

export const matrixToMarkdown = ({
	title,
	columns,
	rows,
}: MatrixView): string => {
	const table =
		columns.length > 0
			? [
					tableRow([
						"",
						...columns.map((column) => column.label),
					]),
					`| --- |${" :-: |".repeat(columns.length)}`,
					...rows.map((row) =>
						tableRow([
							row.label ?? "",
							...row.cells.map((cell) =>
								cell.status ? statusLabel(cell.status) : "",
							),
						]),
					),
				].join("\n")
			: undefined;
	const notes = rows.flatMap((row) =>
		rowNotes(row).map((cell) => {
			const note = cell.note.replaceAll("\n", "\n  ");
			return `- **${row.label ?? ""}, ${cell.column.label}** (${statusLabel(cell.status)}): ${note}`;
		}),
	);
	return [
		title ? `### ${title}` : undefined,
		table,
		notes.length > 0 ? notes.join("\n") : undefined,
	]
		.filter(Boolean)
		.join("\n\n");
};
