import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { columns } from "@/components/users/table/columns";
import { UsersDataTableSelectActions } from "@/components/users/table/users-data-table-select-actions";
import { paginationSchema } from "@/lib/orpc/schemas/shared";
import { userQueryOptions } from "@/lib/query-options/user";

export const Route = createFileRoute("/app/users/")({
	validateSearch: zodValidator(paginationSchema),
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.ensureQueryData(
			userQueryOptions.list({
				input: { pageIndex, pageSize },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: users } = useSuspenseQuery(
		userQueryOptions.list({
			input: { pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-2">
					<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
						Users
					</h4>
					<span className="text-muted-foreground text-sm">
						Showing all users.
					</span>
				</div>
				<div className="flex gap-2">
					<Link
						to={"/app/users/invites"}
						className={buttonVariants({ variant: "outline" })}
					>
						View Invitations
					</Link>
					<Link
						to={"/app/users/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Invite User
					</Link>
				</div>
			</div>
			<div>
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
			</div>
		</div>
	);
}
