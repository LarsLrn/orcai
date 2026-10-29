import type { GroupId } from "@orcai/core";
import { listGroupMembersInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { useMemo } from "react";
import type { z } from "zod/v4";
import { GroupMemberAdd } from "@/components/groups/group-member-add";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { groupMemberTableColumns } from "@/components/groups/table/group-member-table-columns";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	dataTableQuerySchema,
	dataTableSearchDefaults,
	paginationSearchShape,
} from "@/components/ui/data-table/data-table-search-params";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import {
	Section,
	SectionDescription,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listGroupMembersInputSchema
	.omit({
		groupId: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
	});

const membersInput = (
	groupId: GroupId,
	{ pageIndex, pageSize, sort, query }: z.infer<typeof searchSchema>,
) => ({
	groupId,
	query: query || undefined,
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/app/groups/$groupId/")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { groupId }, deps }) => {
		await queryClient.query(
			orpc.group.listMembers.queryOptions({
				input: membersInput(groupId, deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { groupId } = Route.useParams();
	const search = Route.useSearch();

	const {
		data: { data: group },
	} = useSuspenseQuery(
		orpc.group.find.queryOptions({
			input: {
				id: groupId,
			},
		}),
	);
	const { data: members } = useSuspenseQuery(
		orpc.group.listMembers.queryOptions({
			input: membersInput(groupId, search),
		}),
	);
	const columns = useMemo(
		() => groupMemberTableColumns(groupId),
		[
			groupId,
		],
	);

	const isSystemGroup = group.kind === "system";

	return (
		<Page>
			<PageHeader>
				<PageTitle>{group.name}</PageTitle>
				<Badge variant={isSystemGroup ? "outline" : "secondary"}>
					{isSystemGroup ? m.groups_kind_system() : m.groups_kind_custom()}
				</Badge>
			</PageHeader>

			<PageContent className="space-y-6">
				<GroupSettingsForm key={group.id} group={group} />
				{isSystemGroup ? null : <GroupMemberAdd group={group} />}

				<Section aria-labelledby="group-members-title" className="gap-4">
					<SectionHeader>
						<SectionTitle id="group-members-title">
							{m.groups_member_list_title()}
						</SectionTitle>
						<SectionDescription>
							{isSystemGroup
								? m.groups_members_card_description_system()
								: m.groups_member_list_description()}
						</SectionDescription>
					</SectionHeader>
					<DataTable
						data={members.data}
						columns={columns}
						state={{
							pagination: {
								pageIndex: search.pageIndex,
								pageSize: search.pageSize,
							},
							sorting: search.sort,
						}}
						options={{
							rowCount: members.rowCount,
							uidAccessor: (member) => member.user.id,
						}}
					>
						<DataTableToolbar>
							<DataTableSearch
								placeholder={m.groups_member_list_filter_placeholder()}
							/>
							<DataTableToolbarActions>
								<DataTableViewOptions />
							</DataTableToolbarActions>
						</DataTableToolbar>
						<DataTableBody
							empty={{
								Icon: UsersIcon,
								title: m.groups_member_list_empty_title(),
								description: m.groups_member_list_empty_state_description(),
							}}
							filters={{
								query: search.query,
							}}
						/>
						<DataTablePagination />
					</DataTable>
				</Section>
			</PageContent>
		</Page>
	);
}
