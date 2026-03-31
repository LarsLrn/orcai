import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
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
import { paginationSchema } from "@/lib/orpc/schemas/shared";

export const Route = createFileRoute("/app/users/")({
	validateSearch: paginationSchema,
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.ensureQueryData(
			orpc.user.list.queryOptions({
				input: {
					pageIndex,
					pageSize,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: users } = useSuspenseQuery(
		orpc.user.list.queryOptions({
			input: {
				pageIndex,
				pageSize,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Users</PageTitle>
				<PageDescription>Showing all users.</PageDescription>

				<PageAction>
					<Link
						to={"/app/users/invites"}
						className={buttonVariants({
							variant: "outline",
						})}
					>
						View Invitations
					</Link>
					<Link
						to={"/app/users/add"}
						className={buttonVariants({
							variant: "default",
						})}
					>
						Invite User
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
					}}
					options={{
						rowCount: users.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						<UsersDataTableSelectActions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
