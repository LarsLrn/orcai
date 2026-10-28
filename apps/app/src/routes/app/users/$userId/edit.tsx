import type { UserId } from "@orcai/core";
import {
	listUserAccessInputSchema,
	resourceTypeSchema,
	userAccessSourceSchema,
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
	UserIcon,
} from "lucide-react";
import type { z } from "zod/v4";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	dataTableQuerySchema,
	dataTableSearchDefaults,
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
import { ManageUser } from "@/components/users/manage-user";
import {
	userAccessSourceOptions,
	userAccessTableColumns,
	userAccessTypeOptions,
} from "@/components/users/table/user-access-table-columns";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const searchSchema = listUserAccessInputSchema
	.omit({
		id: true,
		filters: true,
		zedToken: true,
	})
	.extend({
		query: dataTableQuerySchema.default(""),
		resourceType: resourceTypeSchema.optional(),
		source: userAccessSourceSchema.optional(),
	});

const accessInput = (
	id: UserId,
	{
		pageIndex,
		pageSize,
		sort,
		query,
		resourceType,
		source,
	}: z.infer<typeof searchSchema>,
) => ({
	id,
	filters: {
		search: query || undefined,
		resourceType,
		source,
	},
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/app/users/$userId/edit")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { userId }, deps }) => {
		await queryClient.query(
			orpc.user.listAccess.queryOptions({
				input: accessInput(userId, deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.users_edit_page_meta_title(),
			},
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const { userId } = Route.useParams();
	const search = Route.useSearch();
	const { data: user } = useSuspenseQuery(
		orpc.user.find.queryOptions({
			input: {
				id: userId,
			},
		}),
	);
	const { data: access } = useSuspenseQuery(
		orpc.user.listAccess.queryOptions({
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
				<PageTitle>{m.users_edit_page_title()}</PageTitle>
			</PageHeader>

			<PageContent className="flex flex-col gap-4">
				<Card>
					<CardHeader>
						<CardTitle>{m.users_edit_details_title()}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="flex items-center gap-2">
								<UserIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">{m.common_name_label()}</p>
									<p className="text-muted-foreground text-sm">
										{user.data.name}
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
										{user.data.email}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<BadgeIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_status_label()}
									</p>
									<div className="flex items-center gap-2">
										<span
											className={`h-2 w-2 rounded-full ${user.data.banned ? "bg-destructive" : "bg-green-500"}`}
										/>
										<p className="text-muted-foreground text-sm">
											{user.data.banned
												? m.users_edit_details_status_banned()
												: m.users_edit_details_status_active()}
										</p>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<MailCheckIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_verification_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{user.data.emailVerified
											? m.users_verification_verified()
											: m.users_verification_not_verified()}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_created_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(user.data.createdAt)}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<div className="space-y-0.5">
									<p className="font-medium text-sm">
										{m.users_edit_details_updated_label()}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatDisplayDate(user.data.updatedAt)}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Section aria-labelledby="user-access-title" className="gap-4">
					<SectionHeader>
						<SectionTitle id="user-access-title">
							{m.users_access_overview_title()}
						</SectionTitle>
						<SectionDescription>
							{m.users_access_overview_description()}
						</SectionDescription>
					</SectionHeader>
					<DataTable
						data={access.data}
						columns={userAccessTableColumns}
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
								placeholder={m.users_access_overview_search_placeholder()}
							/>
							<DataTableSelectFilter
								label={m.users_access_overview_type_column_header()}
								value={search.resourceType}
								options={userAccessTypeOptions()}
								onChange={(resourceType) =>
									setFilter({
										resourceType,
									})
								}
							/>
							<DataTableSelectFilter
								label={m.users_access_overview_source_column_header()}
								value={search.source}
								options={userAccessSourceOptions()}
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
								title: m.users_access_overview_empty_title(),
								description: m.users_access_overview_empty_state_description(),
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
				<ManageUser user={user.data} />
			</PageContent>
		</Page>
	);
}
