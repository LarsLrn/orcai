import { listOrganizationMembersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon, UsersIcon } from "lucide-react";
import { memberTableColumns } from "@/components/members/table/member-table-columns";
import { MembersDataTableSelectActions } from "@/components/members/table/members-data-table-select-actions";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	dataTableQuerySchema,
	paginationSearchShape,
} from "@/components/ui/data-table/data-table-search-params";
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
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listOrganizationMembersInputSchema.extend({
	...paginationSearchShape,
	query: dataTableQuerySchema.default(""),
});

export const Route = createFileRoute("/app/members/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, query, sort } }) => ({
		pageIndex,
		pageSize,
		query,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, query, sort },
	}) => {
		await queryClient.query(
			orpc.organizationMember.list.queryOptions({
				input: {
					filters: {
						search: query.trim() ? query.trim() : undefined,
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
	const { pageIndex, pageSize, query, sort } = Route.useSearch();
	const { data: users } = useSuspenseQuery(
		orpc.organizationMember.list.queryOptions({
			input: {
				filters: {
					search: query.trim() ? query.trim() : undefined,
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
				<PageTitle>{m.members_page_title()}</PageTitle>
				<PageDescription>{m.members_page_description()}</PageDescription>

				<PageAction>
					<Link
						to={"/app/members/invitations"}
						className={buttonVariants({
							variant: "outline",
						})}
					>
						{m.members_list_invitations_link()}
					</Link>
					<Link
						to={"/app/members/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						{m.members_list_invite_action()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={users.data}
					columns={memberTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: users.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableSearch
							placeholder={m.members_list_search_placeholder()}
						/>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<MembersDataTableSelectActions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: UsersIcon,
							title: m.members_list_empty_title(),
							description: m.members_list_empty_description(),
							actions: [
								{
									key: "invite",
									label: m.members_list_invite_action(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/members/add",
									},
								},
							],
						}}
						filters={{
							query,
						}}
					/>
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
