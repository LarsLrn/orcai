import { listAllUsersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";
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
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { instanceUserTableColumns } from "@/components/users/table/instance-user-table-columns";
import { orpc } from "@/lib/orpc/orpc";

const searchSchema = listAllUsersInputSchema.extend({
	query: z.string().trim().max(100).default(""),
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
				title: "Users",
			},
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
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
				<PageTitle>Users</PageTitle>
				<PageDescription>
					Every account of this instance and the organisations it belongs to.
				</PageDescription>
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
							value={query}
							placeholder="Search users..."
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
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
