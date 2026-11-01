import { quotaPoolListInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GaugeIcon, PlusIcon } from "lucide-react";
import { quotaPoolTableColumns } from "@/components/quota/table/quota-pool-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { paginationSearchShape } from "@/components/ui/data-table/data-table-search-params";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/quota-pools/")({
	validateSearch: quotaPoolListInputSchema.extend(paginationSearchShape),
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize, sort },
	}) => {
		await queryClient.query(
			orpc.quotaPool.list.queryOptions({
				input: {
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
	const { pageIndex, pageSize, sort } = Route.useSearch();
	const { data: pools } = useSuspenseQuery(
		orpc.quotaPool.list.queryOptions({
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
				<PageTitle>{m.quota_pools_index_page_title()}</PageTitle>
				<PageAction>
					<Link
						to="/app/quota-pools/add"
						className={buttonVariants({
							variant: "default",
						})}
					>
						{m.quota_pools_index_add_button()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={pools.data}
					columns={quotaPoolTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: pools.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableToolbarActions />
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: GaugeIcon,
							title: m.quota_pools_index_empty_title(),
							description: m.quota_pools_index_empty_description(),
							actions: [
								{
									key: "add",
									label: m.quota_pools_index_add_button(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/quota-pools/add",
									},
								},
							],
						}}
					/>
					<DataTablePagination />
				</DataTable>
			</PageContent>
		</Page>
	);
}
