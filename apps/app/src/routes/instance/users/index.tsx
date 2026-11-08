import { listAllUsersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import type { z } from "zod/v4";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { instanceUserTableColumns } from "@/components/users/table/instance-user-table-columns";
import {
	dataTableQuerySchema,
	paginationSearchShape,
} from "@/lib/browse/data-table-search-params";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listAllUsersInputSchema.extend({
	...paginationSearchShape,
	query: dataTableQuerySchema.default(""),
});

const usersQuery = ({
	pageIndex,
	pageSize,
	query,
	sort,
}: Pick<
	z.output<typeof searchSchema>,
	"pageIndex" | "pageSize" | "query" | "sort"
>) =>
	orpc.user.listAll.queryOptions({
		input: {
			filters: {
				search: query.trim() || undefined,
			},
			pageIndex,
			pageSize,
			sort,
		},
	});

export const Route = createFileRoute("/instance/users/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, query, sort } }) => ({
		pageIndex,
		pageSize,
		query,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await queryClient.query(usersQuery(deps));
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.instance_users_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const search = Route.useSearch();
	const { pageIndex, pageSize, query, sort } = search;
	const { data: users } = useSuspenseQuery(usersQuery(search));

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.instance_users_page_title()}</PageTitle>
				<PageDescription>{m.instance_users_page_description()}</PageDescription>
			</PageHeader>
			<PageContent>
				<DataTable
					data={users.data}
					columns={instanceUserTableColumns}
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
							placeholder={m.instance_users_search_placeholder()}
						/>
						<DataTableToolbarActions />
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: UsersIcon,
							title: m.instance_users_empty_title(),
							description: m.instance_users_empty_description(),
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
