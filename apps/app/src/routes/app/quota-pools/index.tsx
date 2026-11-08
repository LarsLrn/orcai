import { quotaPoolListInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GaugeIcon, PlusIcon } from "lucide-react";
import type { z } from "zod/v4";
import { quotaPoolTableColumns } from "@/components/quota/table/quota-pool-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
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
import { paginationSearchShape } from "@/lib/browse/data-table-search-params";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = quotaPoolListInputSchema.extend(paginationSearchShape);

const quotaPoolsQuery = ({
	pageIndex,
	pageSize,
	sort,
}: z.output<typeof searchSchema>) =>
	orpc.quotaPool.list.queryOptions({
		input: {
			pageIndex,
			pageSize,
			sort,
		},
	});

export const Route = createFileRoute("/app/quota-pools/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await queryClient.query(quotaPoolsQuery(deps));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { pageIndex, pageSize, sort } = search;
	const { data: pools } = useSuspenseQuery(quotaPoolsQuery(search));

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
