import { listProvidersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon, ServerCogIcon } from "lucide-react";
import type { z } from "zod/v4";
import { providerTableColumns } from "@/components/provider/table/provider-table-columns";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTableBulkDelete } from "@/components/ui/data-table/data-table-bulk-delete";
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
import { useDeleteProvidersMutation } from "@/hooks/mutations/use-provider-mutations";
import { paginationSearchShape } from "@/lib/browse/data-table-search-params";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listProvidersInputSchema.extend(paginationSearchShape);

const providersQuery = ({
	pageIndex,
	pageSize,
	sort,
}: z.output<typeof searchSchema>) =>
	orpc.provider.list.queryOptions({
		input: {
			pageIndex,
			pageSize,
			sort,
		},
	});

export const Route = createFileRoute("/app/providers/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, sort } }) => ({
		pageIndex,
		pageSize,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await queryClient.query(providersQuery(deps));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const deleteProviders = useDeleteProvidersMutation();
	const search = Route.useSearch();
	const { pageIndex, pageSize, sort } = search;
	const { data: providers } = useSuspenseQuery(providersQuery(search));

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.providers_route_page_title()}</PageTitle>
				<PageAction>
					<Link
						to="/app/providers/add"
						className={buttonVariants({
							variant: "default",
						})}
					>
						{m.providers_index_add_button()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={providers.data}
					columns={providerTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: providers.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableToolbarActions>
							<DataTableBulkDelete action={deleteProviders} />
						</DataTableToolbarActions>
					</DataTableToolbar>
					<DataTableBody
						empty={{
							Icon: ServerCogIcon,
							title: m.providers_index_empty_title(),
							description: m.providers_index_empty_description(),
							actions: [
								{
									key: "add",
									label: m.providers_index_add_button(),
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/providers/add",
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
