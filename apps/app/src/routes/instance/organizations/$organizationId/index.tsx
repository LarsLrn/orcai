import type { OrganizationId } from "@orcai/core";
import {
	listInstanceOrganizationMembersInputSchema,
	userIdSchema,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	ImageOffIcon,
	MailPlusIcon,
	UserPlusIcon,
	UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { z } from "zod/v4";
import { CheckList } from "@/components/health/check-list";
import {
	AddMemberDialog,
	InviteMemberDialog,
} from "@/components/instance/organization-member-dialogs";
import { instanceOrganizationMemberColumns } from "@/components/instance/table/instance-organization-member-columns";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { organizationCheckTitle } from "@/components/readiness/organization-readiness-card";
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
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import { useRemoveOrganizationLogoMutation } from "@/hooks/mutations/use-instance-image-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const searchSchema = listInstanceOrganizationMembersInputSchema
	.omit({
		organizationId: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
	});

const membersInput = (
	organizationId: OrganizationId,
	{ pageIndex, pageSize, sort, query }: z.infer<typeof searchSchema>,
) => ({
	organizationId,
	query: query || undefined,
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute(
	"/instance/organizations/$organizationId/",
)({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({
		context: { queryClient },
		params: { organizationId },
		deps,
	}) => {
		await Promise.all([
			queryClient.query(
				orpc.instance.organizationMembers.queryOptions({
					input: membersInput(organizationId, deps),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.instance.organizationReadiness.queryOptions({
					input: {
						organizationId,
					},
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { organizationId } = Route.useParams();
	const search = Route.useSearch();
	const { auth } = useAuthenticatedRouteContext();
	const [dialog, setDialog] = useState<"add" | "invite" | null>(null);
	const {
		data: { data: organization },
	} = useSuspenseQuery(
		orpc.instance.organization.queryOptions({
			input: {
				id: organizationId,
			},
		}),
	);
	const {
		data: { data: readiness },
	} = useSuspenseQuery(
		orpc.instance.organizationReadiness.queryOptions({
			input: {
				organizationId,
			},
		}),
	);
	const { data: members } = useSuspenseQuery(
		orpc.instance.organizationMembers.queryOptions({
			input: membersInput(organizationId, search),
		}),
	);
	const removeLogo = useRemoveOrganizationLogoMutation(organization);
	const columns = useMemo(
		() =>
			instanceOrganizationMemberColumns(
				organizationId,
				userIdSchema.parse(auth.user.id),
			),
		[
			organizationId,
			auth.user.id,
		],
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{organization.name}</PageTitle>
				<PageDescription>@{organization.slug}</PageDescription>
				<div className="flex flex-wrap items-center gap-2">
					<OrganizationLogo organization={organization} size="lg" />
					<Badge variant="outline">
						{m.instance_org_member_count({
							count: formatCount(organization.memberCount),
						})}
					</Badge>
				</div>
				<HeaderActions
					actions={[
						{
							key: "invite",
							label: m.instance_org_member_invite_title(),
							icon: MailPlusIcon,
							variant: "default",
							onClick: () => setDialog("invite"),
						},
						{
							key: "add",
							label: m.instance_org_member_add_title(),
							icon: UserPlusIcon,
							onClick: () => setDialog("add"),
						},
						...(organization.logo
							? [
									{
										key: "remove-logo",
										label: m.images_logo_remove_button(),
										icon: ImageOffIcon,
										overflow: true,
										onClick: () =>
											removeLogo.mutate({
												id: organization.id,
											}),
									},
								]
							: []),
					]}
				/>
			</PageHeader>

			<PageContent className="space-y-10">
				{/* Read-only: its fixes live in the organisation's own Manage tab. */}
				<Section
					aria-labelledby="instance-organization-setup-title"
					className="gap-4"
				>
					<SectionHeader>
						<SectionTitle id="instance-organization-setup-title">
							{m.readiness_card_title()}
						</SectionTitle>
						<SectionDescription>
							{m.instance_org_setup_description()}
						</SectionDescription>
					</SectionHeader>
					<CheckList checks={readiness.checks} title={organizationCheckTitle} />
				</Section>
				<Section
					aria-labelledby="instance-organization-members-title"
					className="gap-4"
				>
					<SectionHeader>
						<SectionTitle id="instance-organization-members-title">
							{m.instance_org_members_title()}
						</SectionTitle>
						<SectionDescription>
							{m.instance_org_members_description()}
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
							uidAccessor: (member) => member.userId,
						}}
					>
						<DataTableToolbar>
							<DataTableSearch
								placeholder={m.instance_org_members_search_placeholder()}
							/>
						</DataTableToolbar>
						<DataTableBody
							empty={{
								Icon: UsersIcon,
								title: m.instance_org_members_empty_title(),
								description: m.instance_org_members_empty_description(),
							}}
							filters={{
								query: search.query,
							}}
						/>
						<DataTablePagination />
					</DataTable>
				</Section>
			</PageContent>

			<AddMemberDialog
				organizationId={organizationId}
				open={dialog === "add"}
				onOpenChange={(open) => setDialog(open ? "add" : null)}
			/>
			<InviteMemberDialog
				organizationId={organizationId}
				open={dialog === "invite"}
				onOpenChange={(open) => setDialog(open ? "invite" : null)}
			/>
		</Page>
	);
}
