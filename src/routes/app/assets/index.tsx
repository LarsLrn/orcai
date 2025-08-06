import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { AssetTableActions } from "@/components/documents/table/asset-table-actions";
import { columns } from "@/components/documents/table/columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { assetQueryOptions } from "@/lib/query-options/asset";

export const Route = createFileRoute("/app/assets/")({
	validateSearch: zodValidator(paginationSchema),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.ensureQueryData(
			assetQueryOptions.list({
				input: { pageIndex, pageSize },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: assets } = useSuspenseQuery(
		assetQueryOptions.list({
			input: { pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Assets
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/assets/playground"}
						className={buttonVariants({ variant: "outline" })}
					>
						Playground
					</Link>

					<Link
						to={"/app/assets/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Asset
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={assets.data}
					columns={columns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: assets.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						<AssetTableActions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</div>
		</div>
	);
}
