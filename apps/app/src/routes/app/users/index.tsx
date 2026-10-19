import { listUsersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PlusIcon, UsersIcon } from "lucide-react";
import { z } from "zod/v4";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
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
import { columns } from "@/components/users/table/columns";
import { UsersDataTableSelectActions } from "@/components/users/table/users-data-table-select-actions";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listUsersInputSchema.extend({
	query: z.string().trim().max(100).default(""),
});

export const Route = createFileRoute("/app/users/")({
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
			orpc.user.list.queryOptions({
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
	const navigate = useNavigate();
	const { pageIndex, pageSize, query, sort } = Route.useSearch();
	const { data: users } = useSuspenseQuery(
		orpc.user.list.queryOptions({
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
				<PageTitle>{m.users_page_title()}</PageTitle>
				<PageDescription>{m.users_page_description()}</PageDescription>

				<PageAction>
					<Link
						to={"/app/users/invites"}
						className={buttonVariants({
							variant: "outline",
						})}
					>
						{m.users_list_invitations_link()}
					</Link>
					<Link
						to={"/app/users/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						{m.users_list_invite_action()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={users.data}
					columns={columns}
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
							value={query}
							placeholder={m.users_list_search_placeholder()}
							onChange={(value) =>
								void navigate({
									to: ".",
									search: (prev) => ({
										...prev,
										pageIndex: 0,
										query: value,
									}),
									replace: true,
								})
							}
						/>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<UsersDataTableSelectActions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: UsersIcon,
							title: m.users_list_empty_title(),
							description: m.users_list_empty_description(),
							actions: [
								{
									key: "invite",
									label: m.users_list_invite_action(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/users/add",
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
