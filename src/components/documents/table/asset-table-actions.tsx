import { ReplaceAllIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTable } from "@/components/ui/data-table/data-table-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteAssets } from "@/lib/client-actions/use-delete";

const AssetTableActions = () => {
	const { table } = useTable();
	const { deleteAssets } = useDeleteAssets();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="outline" size="sm" className="h-8">
						<ReplaceAllIcon />
						Actions
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-50">
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
