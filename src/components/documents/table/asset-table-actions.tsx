import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { taskQueryOptions } from "@/lib/query-options/task";

const AssetTableActions = () => {
	const queryClient = useQueryClient();
	const { mutateAsync: createAssetTask } = useMutation(
		taskQueryOptions.createAssetTask(queryClient),
	);

	const { table } = useTable();
	const { deleteAssets } = useDeleteAssets();

	const handleEnqueueAsset = () => {
		const fileIds = table.getSelectedRowModel().flatRows.map((row) => row.id);

		toast.promise(createAssetTask({ taskType: "extract", ids: fileIds }), {
			loading: "Enqueuing asset for processing...",
			success: "Enqueued asset for processing",
			error: (error) => ({
				message: "Failed to enqueue asset for processing",
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
					onClick={() => handleEnqueueAsset()}
					disabled={table.getSelectedRowModel().rows.length === 0}
				>
					Process Asset
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
					Delete Asset
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { AssetTableActions };
