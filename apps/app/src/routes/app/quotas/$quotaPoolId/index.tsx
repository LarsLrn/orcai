import type { GroupId } from "@orcai/core";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod/v4";
import { MetadataCard } from "@/components/app/metadata-card";
import {
	QuotaConsumption,
	QuotaRemaining,
} from "@/components/quota/quota-consumption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAppForm } from "@/hooks/form";
import {
	useDeactivateQuotaPoolMutation,
	useUpdateQuotaPoolMutation,
} from "@/hooks/mutations/use-quota-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { formatNumber } from "@/lib/presentation/format-number";
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

export const Route = createFileRoute("/app/quotas/$quotaPoolId/")({
	loader: async ({ context: { queryClient }, params: { quotaPoolId } }) => {
		await queryClient.query(
			orpc.quota.find.queryOptions({
				input: {
					id: quotaPoolId,
				},
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { quotaPoolId } = Route.useParams();

	const { data } = useSuspenseQuery(
		orpc.quota.find.queryOptions({
			input: {
				id: quotaPoolId,
			},
		}),
	);

	const groups = useQuery(
		orpc.group.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
			},
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
		onSubmit: ({ value }) => {
			updatePool.mutate({
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

	const groupById = useMemo(
		() =>
			new Map(
				(groups.data?.data ?? []).map(
					(group) =>
						[
							group.id,
							group,
						] as const,
				),
			),
		[
			groups.data?.data,
		],
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{data.data.name}</PageTitle>
				{data.data.description ? (
					<PageDescription>{data.data.description}</PageDescription>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Badge variant={data.data.isActive ? "brand" : "secondary"}>
						{data.data.isActive
							? m.common_status_active_label()
							: m.common_status_inactive_label()}
					</Badge>
					<Badge variant="outline">
						{periodTypeLabel(data.data.periodType).toUpperCase()}
					</Badge>
					<Badge variant="outline">
						{data.data.provider.name} / {data.data.provider.meteringMode}
					</Badge>
				</div>
				<PageAction>
					<Link
						to="/app/quotas/$quotaPoolId/edit"
						params={{
							quotaPoolId: data.data.id,
						}}
					>
						<Button variant="outline">{m.quotas_detail_edit_button()}</Button>
					</Link>
					{data.data.isActive ? (
						<Button
							variant="destructive"
							onClick={() =>
								deactivatePool.mutate({
									id: data.data.id,
								})
							}
						>
							{m.quotas_detail_deactivate_button()}
						</Button>
					) : null}
				</PageAction>
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
							<div className="grid gap-4 @sm:grid-cols-2 @2xl:grid-cols-4">
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
										className="justify-start font-semibold text-lg"
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
										className="justify-start font-semibold text-lg"
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
								<Button type="submit">
									{m.quotas_detail_update_budget_button()}
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.quotas_detail_eligible_groups_title()}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{data.data.assignments.map((assignment) => {
									const group = groupById.get(assignment.groupId as GroupId);
									const displayName = group
										? group.kind === "system"
											? m.quotas_form_group_system_label({
													name: group.name,
												})
											: group.name
										: assignment.groupId;

									return (
										<div
											key={assignment.id}
											className="rounded border px-3 py-2 text-sm"
										>
											<Link
												to="/app/groups/$groupId"
												params={{
													groupId: assignment.groupId,
												}}
												className="font-medium hover:underline"
											>
												{displayName}
											</Link>
										</div>
									);
								})}
								{data.data.assignments.length === 0 && (
									<div className="text-muted-foreground text-sm">
										{m.quotas_detail_no_groups_label()}
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.quotas_detail_recent_events_title()}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>
												{m.quotas_detail_event_column_header()}
											</TableHead>
											<TableHead>
												{m.quotas_detail_request_column_header()}
											</TableHead>
											<TableHead className="text-right">
												{m.quotas_detail_reserved_amount_column_header()}
											</TableHead>
											<TableHead className="text-right">
												{m.quotas_detail_actual_amount_column_header()}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.data.recentEvents.map((event) => (
											<TableRow key={event.id}>
												<TableCell className="uppercase">
													{event.eventType}
												</TableCell>
												<TableCell
													className="max-w-48 truncate text-muted-foreground"
													title={event.appRequestId}
												>
													{event.appRequestId}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(event.reservedAmount)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(event.actualAmount)}
												</TableCell>
											</TableRow>
										))}
										{data.data.recentEvents.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={4}
													className="h-24 text-center text-muted-foreground"
												>
													{m.quotas_detail_no_events_label()}
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
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
			</PageContent>
		</Page>
	);
}
