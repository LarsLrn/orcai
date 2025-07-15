"use client";

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { ReplaceAllIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useDeleteAssets } from "@/lib/client-actions/use-delete";
import { orpc } from "@/lib/orpc/orpc";

const DocumentTableActions = () => {
	const { mutateAsync: createDocumentTask } = useMutation(
		orpc.task.createDocumentTask.mutationOptions(),
	);

	const { table } = useTable();
	const { deleteAssets } = useDeleteAssets();

	const handleEnqueueDocument = async () => {
		const fileIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(createDocumentTask({ taskType: "extract", ids: fileIds }), {
			loading: "Enqueuing document for processing...",
			success: "Enqueued document for processing",
			error: (error) => ({
				message: "Failed to enqueue document for processing",
				description: error.message,
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8">
					<ReplaceAllIcon />
					Actions
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px]">
				<DropdownMenuItem
					onClick={() => handleEnqueueDocument()}
					disabled={table.getSelectedRowModel().rows.length === 0}
				>
					Process Documents
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					disabled={table.getSelectedRowModel().rows.length === 0}
					onSelect={() =>
						deleteAssets({
							refs: table
								.getSelectedRowModel()
								.flatRows.map((row) => ({ id: row.id })),
						})
					}
				>
					Delete Documents
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { DocumentTableActions };
