import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod/v4";
import { organizationProviderTableColumns } from "@/components/organizations/providers/table/organization-provider-table-columns";
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

export const Route = createFileRoute("/app/(orgs)/orgs/$orgId_/providers/")({
	validateSearch: zodValidator(searchParams),
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
			orpc.organizationProvider.list.queryOptions({
				input: { organizationId: orgId, pageIndex, pageSize },
				queryKey: orpc.organizationProvider.list.key({
					input: { organizationId: orgId, pageIndex, pageSize },
				}),
			}),
		)
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { orgId } = Route.useParams();
	const { data: providers } = useSuspenseQuery(
		orpc.organizationProvider.list.queryOptions({
			input: { organizationId: orgId, pageIndex, pageSize },
			queryKey: orpc.organizationProvider.list.key({
				input: { organizationId: orgId, pageIndex, pageSize },
			}),
			placeholderData: keepPreviousData,
		}),
	)

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
	)
}
