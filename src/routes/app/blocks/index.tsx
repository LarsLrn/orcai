import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { columns } from "@/components/blocks/table/columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { blockQueryOptions } from "@/lib/query-options/block";

export const Route = createFileRoute("/app/blocks/")({
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
			blockQueryOptions.list({
				input: { pageIndex, pageSize },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: blocks } = useSuspenseQuery(
		blockQueryOptions.list({
			input: { pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Blocks
				</h4>

				<div className="flex gap-2">
					<Link
						to={"/app/blocks/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Block
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={blocks.data}
					columns={columns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: blocks.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						{/* <CoursesDataTableSelectActions /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</div>
		</div>
	);
}
