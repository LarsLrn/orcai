import { listAllOrganizationsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";
import { OrganizationForm } from "@/components/organizations/form/organization-form";
import { instanceOrganizationTableColumns } from "@/components/organizations/table/instance-organization-table-columns";
import { Button } from "@/components/ui/button";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listAllOrganizationsInputSchema.extend({
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
	sort: z.infer<typeof listAllOrganizationsInputSchema>["sort"];
}) => ({
	filters: {
		search: query.trim() ? query.trim() : undefined,
	},
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/instance/organizations/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { pageIndex, pageSize, query, sort } }) => ({
		pageIndex,
		pageSize,
		query,
		sort,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await queryClient.query(
			orpc.organization.listAll.queryOptions({
				input: listInput(deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.instance_organizations_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { pageIndex, pageSize, query, sort } = Route.useSearch();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: organizations } = useSuspenseQuery(
		orpc.organization.listAll.queryOptions({
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
				<PageTitle>{m.instance_organizations_page_title()}</PageTitle>
				<PageDescription>
					{m.instance_organizations_page_description()}
				</PageDescription>
				<PageAction>
					<Button onClick={() => setIsCreateOpen(true)}>
						<PlusIcon />
						{m.instance_organizations_create_button()}
					</Button>
				</PageAction>
			</PageHeader>
			<PageContent>
				<DataTable
					data={organizations.data}
					columns={instanceOrganizationTableColumns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: organizations.rowCount,
						uidAccessor: "id",
					}}
				>
					<DataTableToolbar>
						<DataTableSearch
							value={query}
							placeholder={m.instance_organizations_search_placeholder()}
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

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{m.instance_organizations_create_dialog_title()}
						</DialogTitle>
						<DialogDescription>
							{m.instance_organizations_create_dialog_description()}
						</DialogDescription>
					</DialogHeader>
					<OrganizationForm
						action="create"
						onCompleted={() => setIsCreateOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</Page>
	);
}
