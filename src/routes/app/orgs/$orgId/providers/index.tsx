import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { organizationProviderTableColumns } from "@/components/organizations/providers/table/organization-provider-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";

export const Route = createFileRoute("/app/orgs/$orgId/providers/")({
	validateSearch: zodValidator(paginationSchema),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
		params: { orgId },
	}) => {
		await queryClient.ensureQueryData(
			organizationProviderQueryOptions.list({
				input: { organizationId: orgId, pageIndex, pageSize },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { orgId } = Route.useParams();
	const { data: providers } = useSuspenseQuery(
		organizationProviderQueryOptions.list({
			input: { organizationId: orgId, pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Providers
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/orgs/$orgId/providers/add"}
						params={{ orgId }}
						className={buttonVariants({ variant: "default" })}
					>
						Add Provider
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={providers.data}
					columns={organizationProviderTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: providers.rowCount,
						uidAccessor: "providerSlug",
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
