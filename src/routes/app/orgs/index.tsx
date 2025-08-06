import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { organizationTableColumns } from "@/components/organizations/table/organization-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { organizationQueryOptions } from "@/lib/query-options/organization";

export const Route = createFileRoute("/app/orgs/")({
	validateSearch: zodValidator(paginationSchema),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		return await queryClient.ensureQueryData(
			organizationQueryOptions.list({
				input: { pageIndex, pageSize },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: organizations } = useSuspenseQuery(
		organizationQueryOptions.list({
			input: { pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Organisations
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/orgs/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Add Organisation
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={organizations.data}
					columns={organizationTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: organizations.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</div>
		</div>
	);
}
