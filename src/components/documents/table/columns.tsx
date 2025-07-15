"use client";

import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { convert } from "convert";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/db/schema/document";
import { useDeleteAssets } from "@/lib/client-actions/use-delete";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

export const columns: ColumnDef<Document>[] = [
	{
		id: "select",
		size: 32,
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		size: 500,
		accessorKey: "title",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Title" />
		),
	},
	{
		accessorKey: "size",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Size" />
		),
		cell: ({ row }) => {
			return convert(row.original.size, "bytes").to("best").toString(2);
		},
	},
	{
		accessorKey: "embeddingStatus",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Embedding" />
		),
		cell: ({ row }) => {
			return (
				<Badge
					className={cn({
						"bg-emerald-600": row.original.status === "ready",
						"bg-red-600": row.original.status === "failed",
						"bg-cyan-600": row.original.status === "pending",
						"bg-yellow-600": row.original.status === "processing-document",
						"bg-yellow-400": row.original.status === "generating-embedding",
					})}
				>
					{row.original.status}
				</Badge>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Created At" />
		),
		cell: ({ row }) => (
			<span>{format(row.original.createdAt || "", "MMM dd, yyyy HH:mm")}</span>
		),
	},
	{
		id: "actions",
		size: 32,
		cell: ({ row }) => <ActionCell row={row} />,
	},
];

const ActionCell = ({ row }: { row: Row<Document> }) => {
	const { mutateAsync: createDocumentTask } = useMutation(
		orpc.task.createDocumentTask.mutationOptions(),
	);
	const { deleteAssets } = useDeleteAssets();
	const document = row.original;

	const handleEnqueueDocuments = async (id: string) => {
		toast.promise(createDocumentTask({ taskType: "extract", ids: [id] }), {
			loading: "Enqueuing documents for processing...",
			success: "Enqueued documents for processing",
			error: (error) => ({
				message: "Failed to enqueue documents for processing",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="size-8 p-0">
					<span className="sr-only">Open menu</span>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<Link to={"/app/assets/$assetId"} params={{ assetId: document.id }}>
					<DropdownMenuItem>View Document</DropdownMenuItem>
				</Link>
				<Link
					to={"/app/assets/$assetId/edit"}
					params={{ assetId: document.id }}
				>
					<DropdownMenuItem>Edit Document</DropdownMenuItem>
				</Link>
				<DropdownMenuItem onClick={() => handleEnqueueDocuments(document.id)}>
					Process Document
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onSelect={() => deleteAssets({ refs: [{ id: document.id }] })}
				>
					Delete Document
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
