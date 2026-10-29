import type { UserId } from "@orcai/core";
import {
	listMemberAccessInputSchema,
	memberAccessSourceSchema,
	resourceTypeSchema,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import {
	BadgeIcon,
	CalendarIcon,
	KeyRoundIcon,
	MailCheckIcon,
	MailIcon,
} from "lucide-react";
import type { z } from "zod/v4";
import { ManageMember } from "@/components/members/manage-member";
import {
	memberAccessSourceOptions,
	memberAccessTableColumns,
	memberAccessTypeOptions,
} from "@/components/members/table/member-access-table-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	dataTableQuerySchema,
	dataTableSearchDefaults,
	paginationSearchShape,
} from "@/components/ui/data-table/data-table-search-params";
import { DataTableSelectFilter } from "@/components/ui/data-table/data-table-select-filter";
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
import { UserAvatar } from "@/components/users/user-avatar";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const searchSchema = listMemberAccessInputSchema
	.omit({
		userId: true,
		filters: true,
		zedToken: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
		resourceType: resourceTypeSchema.optional(),
		source: memberAccessSourceSchema.optional(),
	});

const accessInput = (
	userId: UserId,
	{
		pageIndex,
		pageSize,
		sort,
		query,
		resourceType,
		source,
	}: z.infer<typeof searchSchema>,
) => ({
	userId,
	filters: {
		search: query || undefined,
		resourceType,
		source,
	},
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/app/members/$userId/edit")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { userId }, deps }) => {
		await queryClient.query(
			orpc.organizationMember.listAccess.queryOptions({
				input: accessInput(userId, deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.members_edit_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const { userId } = Route.useParams();
	const search = Route.useSearch();
	const { data: member } = useSuspenseQuery(
		orpc.organizationMember.find.queryOptions({
			input: {
				userId,
			},
		}),
	);
	const { data: access } = useSuspenseQuery(
		orpc.organizationMember.listAccess.queryOptions({
			input: accessInput(userId, search),
		}),
	);

	const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) =>
		void navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				...patch,
				pageIndex: 0,
			}),
			replace: true,
		});

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.members_edit_page_title()}</PageTitle>
			</PageHeader>

			<PageContent className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{m.members_edit_details_title()}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="flex items-center gap-2">
								<UserAvatar user={member.data} size="sm" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">{m.common_name_label()}</p>
									<p className="text-muted-foreground text-sm">
										{member.data.name}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.common_email_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{member.data.email}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<BadgeIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.members_edit_details_status_label()}
									</p>
									<div className="flex items-center gap-2">
										<span
											className={`h-2 w-2 rounded-full ${member.data.banned ? "bg-destructive" : "bg-green-500"}`}
										/>
										<p className="text-muted-foreground text-sm">
											{member.data.banned
												? m.members_edit_details_status_banned()
												: m.members_edit_details_status_active()}
										</p>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailCheckIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.members_edit_details_verification_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{member.data.emailVerified
											? m.members_verification_verified()
											: m.members_verification_not_verified()}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.members_edit_details_created_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(member.data.createdAt)}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.members_edit_details_updated_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(member.data.updatedAt)}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Section aria-labelledby="member-access-title" className="gap-4">
					<SectionHeader>
						<SectionTitle id="member-access-title">
							{m.members_access_overview_title()}
						</SectionTitle>
						<SectionDescription>
							{m.members_access_overview_description()}
						</SectionDescription>
					</SectionHeader>
					<DataTable
						data={access.data}
						columns={memberAccessTableColumns}
						state={{
							pagination: {
								pageIndex: search.pageIndex,
								pageSize: search.pageSize,
							},
							sorting: search.sort,
						}}
						options={{
							rowCount: access.rowCount,
							uidAccessor: "resourceId",
						}}
					>
						<DataTableToolbar>
							<DataTableSearch
								placeholder={m.members_access_overview_search_placeholder()}
							/>
							<DataTableSelectFilter
								label={m.members_access_overview_type_column_header()}
								value={search.resourceType}
								options={memberAccessTypeOptions()}
								onChange={(resourceType) =>
									setFilter({
										resourceType,
									})
								}
							/>
							<DataTableSelectFilter
								label={m.members_access_overview_source_column_header()}
								value={search.source}
								options={memberAccessSourceOptions()}
								onChange={(source) =>
									setFilter({
										source,
									})
								}
							/>
							<DataTableToolbarActions>
								<DataTableViewOptions />
							</DataTableToolbarActions>
						</DataTableToolbar>
						<DataTableBody
							empty={{
								Icon: KeyRoundIcon,
								title: m.members_access_overview_empty_title(),
								description:
									m.members_access_overview_empty_state_description(),
							}}
							filters={{
								query: search.query,
								resourceType: search.resourceType,
								source: search.source,
							}}
						/>
						<DataTablePagination />
					</DataTable>
				</Section>
				<ManageMember member={member.data} />
			</PageContent>
		</Page>
	);
}
