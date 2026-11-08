import { listOrganizationInvitationsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MailIcon, PlusIcon } from "lucide-react";
import type { z } from "zod/v4";
import { invitationsTableColumns } from "@/components/members/invitations/table/invitations-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTableBulkDelete } from "@/components/ui/data-table/data-table-bulk-delete";
import { DataTableExportButton } from "@/components/ui/data-table/data-table-export-button";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useMembershipControl } from "@/hooks/authz/use-membership-control";
import { useDeleteOrganizationInvitationsMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { paginationSearchShape } from "@/lib/browse/data-table-search-params";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listOrganizationInvitationsInputSchema.extend(
	paginationSearchShape,
);

const invitationsQuery = ({
	pageIndex,
	pageSize,
	sort,
}: z.output<typeof searchSchema>) =>
	orpc.organizationInvitation.list.queryOptions({
		input: {
			pageIndex,
			pageSize,
			sort,
		},
	});

export const Route = createFileRoute("/app/members/invitations")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		return await queryClient.query(invitationsQuery(deps));
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.members_invitations_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	const deleteInvitations = useDeleteOrganizationInvitationsMutation();
	const search = Route.useSearch();
	const { pageIndex, pageSize, sort } = search;
	const { data: invitations } = useSuspenseQuery(invitationsQuery(search));
	const { canManageRole } = useMembershipControl();

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.members_invitations_page_title()}</PageTitle>
				<PageDescription>
					{m.members_invitations_page_description()}
				</PageDescription>
				<PageAction>
					<Link
						to={"/app/members/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						{m.members_invitations_invite_action()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={invitations.data}
					columns={invitationsTableColumns}
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
						enableRowSelection: (row) => canManageRole(row.original.role),
					}}
				>
					<DataTableToolbar>
						<DataTableToolbarActions>
							<DataTableBulkDelete action={deleteInvitations} />
							<DataTableExportButton
								fileName={m.members_invitations_export_file_name()}
							/>
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: MailIcon,
							title: m.members_invitations_empty_title(),
							description: m.members_invitations_empty_description(),
							actions: [
								{
									key: "invite",
									label: m.members_invitations_invite_action(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/members/add",
									},
								},
							],
						}}
					/>
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
