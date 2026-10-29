import {
	quotaUsageEventListInputSchema,
	quotaUsageEventTypeSchema,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { EditIcon, PowerOffIcon, ReceiptTextIcon } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod/v4";
import { MetadataCard } from "@/components/app/metadata-card";
import {
	QuotaConsumption,
	QuotaRemaining,
} from "@/components/quota/quota-consumption";
import { QuotaEligibleGroups } from "@/components/quota/quota-eligible-groups";
import {
	quotaUsageEventTableColumns,
	quotaUsageEventTypeOptions,
} from "@/components/quota/table/quota-usage-event-table-columns";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { useAppForm } from "@/hooks/form";
import {
	useDeactivateQuotaPoolMutation,
	useUpdateQuotaPoolMutation,
} from "@/hooks/mutations/use-quota-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { formatNumber } from "@/lib/presentation/format-number";
import {
	getQuotaPoolStatusLabel,
	getQuotaPoolStatusVariant,
} from "@/lib/presentation/quota-pool-status";
import { orNotFound } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const updateBudgetFormSchema = z.object({
	budgetAmount: z.number().int().positive(),
});

const periodTypeLabel = (periodType: "weekly" | "monthly" | "yearly") => {
	switch (periodType) {
		case "weekly":
			return m.quotas_period_weekly_label();
		case "monthly":
			return m.quotas_period_monthly_label();
		case "yearly":
			return m.quotas_period_yearly_label();
	}
};

const searchSchema = quotaUsageEventListInputSchema
	.omit({
		quotaPoolId: true,
		filters: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
		eventType: quotaUsageEventTypeSchema.optional(),
	});

type EventsSearch = z.infer<typeof searchSchema>;

const eventsInput = (
	quotaPoolId: z.infer<typeof quotaUsageEventListInputSchema>["quotaPoolId"],
	{ pageIndex, pageSize, sort, query, eventType }: EventsSearch,
) => ({
	quotaPoolId,
	filters: {
		eventType,
		search: query || undefined,
	},
	pageIndex,
	pageSize,
	sort,
});

export const Route = createFileRoute("/app/quotas/$quotaPoolId/")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({
		context: { queryClient },
		params: { quotaPoolId },
		deps,
	}) => {
		await Promise.all([
			orNotFound(
				queryClient.query(
					orpc.quota.find.queryOptions({
						input: {
							id: quotaPoolId,
						},
						staleTime: "static",
					}),
				),
			),
			queryClient.query(
				orpc.quota.listEvents.queryOptions({
					input: eventsInput(quotaPoolId, deps),
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { quotaPoolId } = Route.useParams();
	const search = Route.useSearch();

	const { data } = useSuspenseQuery(
		orpc.quota.find.queryOptions({
			input: {
				id: quotaPoolId,
			},
		}),
	);

	const { data: events } = useSuspenseQuery(
		orpc.quota.listEvents.queryOptions({
			input: eventsInput(quotaPoolId, search),
		}),
	);

	const updatePool = useUpdateQuotaPoolMutation();
	const deactivatePool = useDeactivateQuotaPoolMutation({}, data.data.name);

	const budgetForm = useAppForm({
		defaultValues: {
			budgetAmount: data.data.budgetAmount,
		},
		validators: {
			onChange: updateBudgetFormSchema,
		},
		onSubmit: async ({ value }) => {
			await updatePool.mutateAsync({
				id: data.data.id,
				budgetAmount: value.budgetAmount,
			});
		},
	});

	useEffect(() => {
		budgetForm.setFieldValue("budgetAmount", data.data.budgetAmount);
	}, [
		budgetForm,
		data.data.budgetAmount,
	]);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{data.data.name}</PageTitle>
				{data.data.description ? (
					<PageDescription>{data.data.description}</PageDescription>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Badge variant={getQuotaPoolStatusVariant(data.data.isActive)}>
						{getQuotaPoolStatusLabel(data.data.isActive)}
					</Badge>
					<Badge variant="outline">
						{periodTypeLabel(data.data.periodType).toUpperCase()}
					</Badge>
					<Badge
						variant="outline"
						className="max-w-full"
						title={`${data.data.provider.name} / ${data.data.provider.meteringMode}`}
					>
						<span className="truncate">
							{data.data.provider.name} / {data.data.provider.meteringMode}
						</span>
					</Badge>
				</div>
				<HeaderActions
					actions={[
						{
							key: "edit",
							label: m.quotas_detail_edit_button(),
							icon: EditIcon,
							variant: "default",
							linkProps: {
								to: "/app/quotas/$quotaPoolId/edit",
								params: {
									quotaPoolId: data.data.id,
								},
							},
						},
						data.data.isActive && {
							key: "deactivate",
							label: m.quotas_detail_deactivate_button(),
							icon: PowerOffIcon,
							destructive: true,
							loading: deactivatePool.isPending,
							onClick: () =>
								deactivatePool.mutate({
									id: data.data.id,
								}),
						},
					]}
				/>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>{m.quotas_detail_current_usage_title()}</CardTitle>
							<CardDescription>
								{m.quotas_detail_current_usage_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="@container">
							<div className="grid @2xl:grid-cols-4 @sm:grid-cols-2 gap-4">
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.quotas_detail_budget_metric_label()}
									</div>
									<div className="font-semibold text-lg">
										{formatNumber(data.data.currentLedger?.budgetAmount)}
									</div>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.quotas_detail_consumed_metric_label()}
									</div>
									<QuotaConsumption
										className="font-semibold text-lg"
										consumedAmount={data.data.currentLedger?.consumedAmount}
										budgetAmount={data.data.currentLedger?.budgetAmount}
										unit={data.data.provider.meteringMode}
									/>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.quotas_detail_reserved_metric_label()}
									</div>
									<div className="font-semibold text-lg">
										{formatNumber(data.data.currentLedger?.reservedAmount)}
									</div>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.quotas_detail_remaining_metric_label()}
									</div>
									<QuotaRemaining
										className="font-semibold text-lg"
										remainingAmount={data.data.currentLedger?.remainingAmount}
										budgetAmount={data.data.currentLedger?.budgetAmount}
										unit={data.data.provider.meteringMode}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.quotas_detail_adjust_budget_title()}</CardTitle>
						</CardHeader>
						<CardContent>
							<form
								className="flex flex-wrap items-end gap-2"
								onSubmit={(event) => {
									event.preventDefault();
									budgetForm.handleSubmit();
								}}
							>
								<div className="w-full sm:w-80">
									<budgetForm.AppField
										name="budgetAmount"
										children={(field) => (
											<field.TextField
												label={m.quotas_detail_new_budget_label()}
												type="number"
												min={1}
												description={m.quotas_detail_new_budget_description()}
											/>
										)}
									/>
								</div>
								<budgetForm.AppForm>
									<budgetForm.SubmitButton
										label={m.quotas_detail_update_budget_button()}
									/>
								</budgetForm.AppForm>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.quotas_detail_eligible_groups_title()}</CardTitle>
							<CardDescription>
								{m.quotas_detail_eligible_groups_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<QuotaEligibleGroups assignments={data.data.assignments} />
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<MetadataCard
						id={data.data.id}
						createdAt={data.data.createdAt}
						updatedAt={data.data.updatedAt}
					/>
				</div>

				<Section className="gap-4 lg:col-span-3">
					<SectionHeader>
						<SectionTitle>{m.quotas_detail_usage_events_title()}</SectionTitle>
						<SectionDescription>
							{m.quotas_detail_usage_events_description()}
						</SectionDescription>
					</SectionHeader>
					<DataTable
						data={events.data}
						columns={quotaUsageEventTableColumns}
						state={{
							pagination: {
								pageIndex: search.pageIndex,
								pageSize: search.pageSize,
							},
							sorting: search.sort,
						}}
						options={{
							rowCount: events.rowCount,
							uidAccessor: "id",
						}}
					>
						<DataTableToolbar>
							<DataTableSearch
								placeholder={m.quotas_events_search_placeholder()}
							/>
							<DataTableSelectFilter
								label={m.quotas_detail_event_column_header()}
								value={search.eventType}
								options={quotaUsageEventTypeOptions()}
								onChange={(eventType) =>
									void navigate({
										to: ".",
										search: (prev) => ({
											...prev,
											pageIndex: 0,
											eventType,
										}),
										replace: true,
									})
								}
							/>
							<DataTableToolbarActions>
								<DataTableViewOptions />
							</DataTableToolbarActions>
						</DataTableToolbar>
						<DataTableBody
							empty={{
								Icon: ReceiptTextIcon,
								title: m.quotas_events_empty_title(),
								description: m.quotas_events_empty_description(),
							}}
							filters={{
								query: search.query,
								eventType: search.eventType,
							}}
						/>
						<DataTablePagination />
					</DataTable>
				</Section>
			</PageContent>
		</Page>
	);
}
