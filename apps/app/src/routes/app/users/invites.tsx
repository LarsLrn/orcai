import { listOrganizationInvitationsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTableExportButton } from "@/components/ui/data-table/data-table-export-button";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { InvitesTableActions } from "@/components/users/invites/table/invites-table-actions";
import { invitesTableColumns } from "@/components/users/invites/table/invites-table-columns";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/users/invites")({
	validateSearch: listOrganizationInvitationsInputSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({
		context: { auth, queryClient },
		deps: { pageIndex, pageSize, sort },
	}) => {
		return await queryClient.ensureQueryData(
			orpc.organizationInvitation.list.queryOptions({
				input: {
					organizationId: auth.session.activeOrganizationId,
					pageIndex,
					pageSize,
					sort,
				},
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Invites",
			},
		],
	}),
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { pageIndex, pageSize, sort } = Route.useSearch();
	const { data: invitations } = useSuspenseQuery(
		orpc.organizationInvitation.list.queryOptions({
			input: {
				organizationId: auth.session.activeOrganizationId,
				pageIndex,
				pageSize,
				sort,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Organisation Invitations</PageTitle>
				<PageDescription>
					Manage your organisation's invitations.
				</PageDescription>
				<PageAction>
					<Link
						to={"/app/users/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						Invite Users
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={invitations.data}
					columns={invitesTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: invitations.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<InvitesTableActions />
							<DataTableExportButton fileName="invitations" />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
