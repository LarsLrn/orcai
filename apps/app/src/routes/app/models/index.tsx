import type { ModelListRow } from "@orcai/schema";
import { listModelsInputSchema, providerIdSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";
import { DiscoverModels } from "@/components/model/discover-models";
import { ModelTableActions } from "@/components/model/table/model-table-actions";
import { modelTableColumns } from "@/components/model/table/model-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { DataTableSelectFilter } from "@/components/ui/data-table/data-table-select-filter";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

const searchSchema = listModelsInputSchema
	.omit({
		filters: true,
	})
	.extend({
		query: z.string().trim().max(100).default(""),
		providerId: providerIdSchema.optional(),
	});

export const Route = createFileRoute("/app/models/")({
	validateSearch: searchSchema,
	loaderDeps: ({
		search: { pageIndex, pageSize, providerId, query, sort },
	}) => ({
		pageIndex,
		pageSize,
		providerId,
		query,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, providerId, query, sort },
	}) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.model.list.queryOptions({
					input: {
						filters: {
							providerId,
							search: query || undefined,
						},
						pageIndex,
						pageSize,
						sort,
					},
				}),
			),
			queryClient.ensureQueryData(
				orpc.provider.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 200,
					},
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { pageIndex, pageSize, providerId, query, sort } = Route.useSearch();
	const { data: models } = useSuspenseQuery(
		orpc.model.list.queryOptions({
			input: {
				filters: {
					providerId,
					search: query || undefined,
				},
				pageIndex,
				pageSize,
				sort,
			},
		}),
	);
	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
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
				<DataTable<ModelListRow, unknown>
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
					<DataTableToolbar>
						<DataTableSearch
							value={query}
							placeholder="Search models or providers..."
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
						<DataTableSelectFilter
							label="Provider"
							value={providerId}
							options={providers.data.map((provider) => ({
								label: provider.name,
								value: provider.id,
							}))}
							onChange={(value) =>
								void navigate({
									to: ".",
									search: (prev) => ({
										...prev,
										pageIndex: 0,
										providerId: value,
									}),
								})
							}
						/>
						<DataTableToolbarActions>
							<DataTableViewOptions />
							<ModelTableActions />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody />
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
