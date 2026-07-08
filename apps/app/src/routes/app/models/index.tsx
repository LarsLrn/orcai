import { listModelsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DiscoverModels } from "@/components/model/discover-models";
import { ModelTableActions } from "@/components/model/table/model-table-actions";
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

export const Route = createFileRoute("/app/models/")({
	validateSearch: listModelsInputSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, sort },
	}) => {
		await queryClient.ensureQueryData(
			orpc.model.list.queryOptions({
				input: {
					pageIndex,
					pageSize,
					sort,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize, sort } = Route.useSearch();
	const { data: models } = useSuspenseQuery(
		orpc.model.list.queryOptions({
			input: {
				pageIndex,
				pageSize,
				sort,
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
						sorting: sort,
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
						<ModelTableActions />
						{/* <SearchInput /> */}
					</div>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
