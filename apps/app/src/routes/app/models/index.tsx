import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DiscoverModels } from "@/components/model/discover-models";
import { modelTableColumns } from "@/components/model/table/model-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { paginationSchema } from "@/lib/orpc/schemas/shared";

export const Route = createFileRoute("/app/models/")({
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
			orpc.model.list.queryOptions({
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
	const { data: models } = useSuspenseQuery(
		orpc.model.list.queryOptions({
			input: {
				pageIndex,
				pageSize,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Models</PageTitle>
				<PageAction>
					<Link
						to="/app/models/add"
						className={buttonVariants({
							variant: "default",
						})}
					>
						Add Model
					</Link>
					<DiscoverModels />
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={models.data}
					columns={modelTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
					}}
					options={{
						rowCount: models.rowCount,
						uidAccessor: "id",
						clientPagination: {
							pageIndex,
							pageSize,
						},
					}}
				>
					<div className="flex items-center gap-2">
						<DataTableViewOptions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
