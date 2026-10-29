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
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { instanceUserTableColumns } from "@/components/users/table/instance-user-table-columns";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listAllUsersInputSchema.extend({
	...paginationSearchShape,
	query: dataTableQuerySchema.default(""),
});

const listInput = ({
	pageIndex,
	pageSize,
	query,
	sort,
}: {
	pageIndex: number;
	pageSize: number;
	query: string;
	sort: z.infer<typeof listAllUsersInputSchema>["sort"];
}) => ({
	filters: {
		search: query.trim() ? query.trim() : undefined,
	},
	pageIndex,
	pageSize,
	sort,
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
		await queryClient.query(
			orpc.user.listAll.queryOptions({
				input: listInput(deps),
				staleTime: "static",
			}),
		);
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
	const { pageIndex, pageSize, query, sort } = Route.useSearch();
	const { data: users } = useSuspenseQuery(
		orpc.user.listAll.queryOptions({
			input: listInput({
				pageIndex,
				pageSize,
				query,
				sort,
			}),
		}),
	);

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
						<DataTableToolbarActions>
							<DataTableViewOptions />
						</DataTableToolbarActions>
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
