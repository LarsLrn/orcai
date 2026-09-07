import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import { listOrganizationsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { organizationTableColumns } from "@/components/organizations/table/organization-table-columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageContent,
	PageDescription,
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
		return await queryClient.query(
			orpc.organization.list.queryOptions({
				input: {
					filters: {
						role: ORGANIZATION_ADMIN_ROLE,
					},
					pageIndex,
					pageSize,
					sort,
				},
				staleTime: "static",
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
				filters: {
					role: ORGANIZATION_ADMIN_ROLE,
				},
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
				<PageDescription>The organisations you administer.</PageDescription>
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
					}}
				>
					<DataTableToolbar>
						<DataTableToolbarActions>
							<DataTableViewOptions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
