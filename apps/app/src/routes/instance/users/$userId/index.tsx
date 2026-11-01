import type { UserId } from "@orcai/core";
import { listInstanceUserMembershipsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { Building2Icon } from "lucide-react";
import type { z } from "zod/v4";
import { instanceUserMembershipColumns } from "@/components/instance/table/instance-user-membership-columns";
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
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import {
	Section,
	SectionDescription,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useInstanceUserActions } from "@/components/users/instance-user-actions";
import { UserAvatar } from "@/components/users/user-avatar";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = listInstanceUserMembershipsInputSchema
	.omit({
		userId: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
	});

const membershipsInput = (
	userId: UserId,
	{ pageIndex, pageSize, sort, query }: z.infer<typeof searchSchema>,
) => ({
	userId,
	query: query || undefined,
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/instance/users/$userId/")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { userId }, deps }) => {
		await queryClient.query(
			orpc.instance.userMemberships.queryOptions({
				input: membershipsInput(userId, deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { userId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const {
		data: { data: user },
	} = useSuspenseQuery(
		orpc.instance.user.queryOptions({
			input: {
				id: userId,
			},
		}),
	);
	const { data: memberships } = useSuspenseQuery(
		orpc.instance.userMemberships.queryOptions({
			input: membershipsInput(userId, search),
		}),
	);
	const { actions, dialog } = useInstanceUserActions(user, {
		onDeleted: () =>
			void navigate({
				to: "/instance/users",
			}),
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>{user.name}</PageTitle>
				<PageDescription>{user.email}</PageDescription>
				<div className="flex flex-wrap items-center gap-2">
					<UserAvatar user={user} size="lg" />
					{isInstanceAdminRole(user.role) && (
						<Badge variant="secondary">
							{m.instance_users_table_instance_role_admin_label()}
						</Badge>
					)}
					{user.banned && (
						<Badge variant="destructive">
							{m.instance_users_table_status_banned_label()}
						</Badge>
					)}
					{user.twoFactorEnabled && (
						<Badge variant="success">
							{m.instance_users_table_two_factor_on_label()}
						</Badge>
					)}
				</div>
				<HeaderActions actions={actions} />
			</PageHeader>

			<PageContent>
				<Section
					aria-labelledby="instance-user-memberships-title"
					className="gap-4"
				>
					<SectionHeader>
						<SectionTitle id="instance-user-memberships-title">
							{m.instance_user_memberships_title()}
						</SectionTitle>
						<SectionDescription>
							{m.instance_user_memberships_description()}
						</SectionDescription>
					</SectionHeader>
					<DataTable
						data={memberships.data}
						columns={instanceUserMembershipColumns}
						state={{
							pagination: {
								pageIndex: search.pageIndex,
								pageSize: search.pageSize,
							},
							sorting: search.sort,
						}}
						options={{
							rowCount: memberships.rowCount,
							uidAccessor: (membership) => membership.organizationId,
						}}
					>
						<DataTableToolbar>
							<DataTableSearch
								placeholder={m.instance_user_memberships_search_placeholder()}
							/>
						</DataTableToolbar>
						<DataTableBody
							empty={{
								Icon: Building2Icon,
								title: m.instance_user_memberships_empty_title(),
								description: m.instance_user_memberships_empty_description(),
							}}
							filters={{
								query: search.query,
							}}
						/>
						<DataTablePagination />
					</DataTable>
				</Section>
			</PageContent>
			{dialog}
		</Page>
	);
}
