import { ChevronDownIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
	type MatrixView,
	rowNotes,
} from "@/components/chat/gen-ui/matrix/cells";
import { statusLabel } from "@/components/chat/gen-ui/status";
import { StatusIcon, Tally } from "@/components/chat/gen-ui/status-icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Matrix = ({
	view,
	streaming,
}: {
	view: MatrixView;
	streaming: boolean;
}) => {
	const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
	const toggle = (index: number) =>
		setOpen((current) => {
			const next = new Set(current);
			if (!next.delete(index)) {
				next.add(index);
			}
			return next;
		});

	const { title, columns, rows } = view;
	const statuses = rows.flatMap((row) => row.cells.map((cell) => cell.status));
	const withHeader = Boolean(title) || statuses.some(Boolean);

	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			{withHeader && (
				<div className="flex items-center justify-between gap-4 border-b px-4 py-3">
					{title && <h3 className="min-w-0 font-medium text-sm">{title}</h3>}
					<Tally statuses={statuses} className="ml-auto" />
				</div>
			)}
			{columns.length === 0 && streaming ? (
				<div className="space-y-2 px-4 py-3">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="pl-4" />
							{columns.map((column, index) => (
								<TableHead key={index} className="text-center text-xs">
									{column.label}
								</TableHead>
							))}
							<TableHead className="pr-4" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row, rowIndex) => {
							const notes = rowNotes(row);
							const expandable = notes.length > 0;
							const isOpen = expandable && open.has(rowIndex);
							return (
								<Fragment key={rowIndex}>
									<TableRow
										className={cn(
											expandable && "cursor-pointer",
											isOpen && "border-b-0 bg-muted/40",
										)}
										onClick={expandable ? () => toggle(rowIndex) : undefined}
									>
										<TableCell className="pl-4 font-medium">
											{row.label}
										</TableCell>
										{row.cells.map((cell, index) => (
											<TableCell
												key={index}
												className="text-center"
												title={cell.status && statusLabel(cell.status)}
											>
												<StatusIcon
													status={cell.status}
													pending={streaming}
													className="mx-auto"
												/>
											</TableCell>
										))}
										<TableCell className="pr-4 text-right">
											{expandable && (
												<button
													type="button"
													aria-expanded={isOpen}
													className="inline-flex items-center gap-1 rounded-sm text-muted-foreground text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
													onClick={(event) => {
														event.stopPropagation();
														toggle(rowIndex);
													}}
												>
													{m.gen_ui_matrix_notes({
														count: notes.length,
													})}
													<ChevronDownIcon
														aria-hidden
														className={cn(
															"size-4 transition-transform",
															isOpen && "rotate-180",
														)}
													/>
												</button>
											)}
										</TableCell>
									</TableRow>
									{isOpen && (
										<TableRow className="bg-muted/40 hover:bg-muted/40">
											<TableCell
												colSpan={columns.length + 2}
												className="whitespace-normal px-4 pt-0 pb-3"
											>
												<ul className="space-y-1.5">
													{notes.map((note) => (
														<li key={note.column.key} className="flex gap-2.5">
															<StatusIcon status={note.status} />
															<div className="min-w-0 flex-1">
																<span className="font-medium">
																	{note.column.label}
																</span>{" "}
																<MessageResponse className="inline text-muted-foreground [&>p]:inline">
																	{note.note}
																</MessageResponse>
															</div>
														</li>
													))}
												</ul>
											</TableCell>
										</TableRow>
									)}
								</Fragment>
							);
						})}
					</TableBody>
				</Table>
			)}
		</div>
	);
};
