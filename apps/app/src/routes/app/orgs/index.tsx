import { listOrganizationsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OrganizationTableActions } from "@/components/organizations/table/organization-table-actions";
import { organizationTableColumns } from "@/components/organizations/table/organization-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/orgs/")({
	validateSearch: listOrganizationsInputSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, sort },
	}) => {
		return await queryClient.ensureQueryData(
			orpc.organization.list.queryOptions({
				input: {
					pageIndex,
					pageSize,
					sort,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize, sort } = Route.useSearch();
	const { data: organizations } = useSuspenseQuery(
		orpc.organization.list.queryOptions({
			input: {
				pageIndex,
				pageSize,
				sort,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Organisations</PageTitle>
				<PageAction>
					<Link
						to={"/app/orgs/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						Add Organisation
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={organizations.data}
					columns={organizationTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
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
						<OrganizationTableActions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
