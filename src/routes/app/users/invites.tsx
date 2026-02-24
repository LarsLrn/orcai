import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTableExportButton } from "@/components/ui/data-table/data-table-export-button";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { InvitesTableActions } from "@/components/users/invites/table/invites-table-actions";
import { invitesTableColumns } from "@/components/users/invites/table/invites-table-columns";
import { orpc } from "@/lib/orpc/orpc";
import { paginationSchema } from "@/lib/orpc/schemas/shared";

export const Route = createFileRoute("/app/users/invites")({
	validateSearch: paginationSchema,
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		return await queryClient.ensureQueryData(
			orpc.organizationInvitation.list.queryOptions({
				input: { pageIndex, pageSize },
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
	const { pageIndex, pageSize } = Route.useSearch();
	const { data: invitations } = useSuspenseQuery(
		orpc.organizationInvitation.list.queryOptions({
			input: { pageIndex, pageSize },
		}),
	);

	return (
		<div className="flex flex-col gap-14">
			<div className="flex w-full flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="max-w-xl font-regular text-3xl tracking-tighter md:text-5xl">
					Organization Invitations
				</h4>
				<div className="flex gap-2">
					<Link
						to={"/app/users/add"}
						className={buttonVariants({ variant: "default" })}
					>
						Invite Users
					</Link>
				</div>
			</div>
			<div>
				<DataTable
					data={invitations.data}
					columns={invitesTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: invitations.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						<InvitesTableActions />
						<DataTableExportButton fileName="invitations" />
						{/* <SearchInput placeholder="Search by email..." /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</div>
		</div>
	);
}
