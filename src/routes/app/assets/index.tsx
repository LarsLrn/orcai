import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod/v4";
import { AssetTableActions } from "@/components/documents/table/asset-table-actions";
import { columns } from "@/components/documents/table/columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { orpc } from "@/lib/orpc/orpc";

const searchParams = z.object({
	pageIndex: z.coerce.number().default(0),
	pageSize: z.coerce.number().default(1),
});

export const Route = createFileRoute("/app/assets/")({
	validateSearch: zodValidator(searchParams),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.ensureQueryData(
			orpc.asset.list.queryOptions({
				input: { pageIndex, pageSize },
				queryKey: orpc.asset.list.key({
					input: { pageIndex, pageSize },
				}),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const courseId = "placeholder"; // TODO: Replace with actual courseId when available

	const { pageIndex, pageSize } = Route.useSearch();
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: { courseId, pageIndex, pageSize },
			queryKey: orpc.asset.list.key({
				input: { pageIndex, pageSize },
			}),
			placeholderData: keepPreviousData,
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
