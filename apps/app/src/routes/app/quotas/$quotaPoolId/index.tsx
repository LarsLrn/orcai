import type { GroupId } from "@orcai/core";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod/v4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useAppForm } from "@/hooks/form";
import {
	useDeactivateQuotaPoolMutation,
	useUpdateQuotaPoolMutation,
} from "@/hooks/mutations/use-quota-mutations";
import { orpc } from "@/lib/orpc/orpc";

const updateBudgetFormSchema = z.object({
	budgetAmount: z.number().int().positive(),
});

export const Route = createFileRoute("/app/quotas/$quotaPoolId/")({
	loader: async ({ context: { queryClient }, params: { quotaPoolId } }) => {
		await queryClient.ensureQueryData(
			orpc.quota.find.queryOptions({
				input: {
					id: quotaPoolId,
				},
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
	const deactivatePool = useDeactivateQuotaPoolMutation();

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
				<PageAction>
					<Link
						to="/app/quotas/$quotaPoolId/edit"
						params={{
							quotaPoolId: data.data.id,
						}}
					>
						<Button variant="outline">Edit Pool</Button>
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
							Deactivate Pool
						</Button>
					) : null}
				</PageAction>
			</PageHeader>
			<PageContent className="space-y-6">
				<div className="rounded-lg border p-4">
					<div className="mb-4 flex items-center gap-2">
						<Badge variant={data.data.isActive ? "default" : "secondary"}>
							{data.data.isActive ? "Active" : "Inactive"}
						</Badge>
						<Badge variant="outline">
							{data.data.periodType.toUpperCase()}
						</Badge>
						<Badge variant="outline">
							{data.data.provider.name} / {data.data.provider.meteringMode}
						</Badge>
					</div>
					<div className="grid gap-4 md:grid-cols-4">
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								Budget
							</div>
							<div className="font-semibold text-lg">
								{data.data.currentLedger?.budgetAmount != null
									? data.data.currentLedger.budgetAmount.toLocaleString()
									: "-"}
							</div>
						</div>
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								Consumed
							</div>
							<div className="font-semibold text-lg">
								{data.data.currentLedger?.consumedAmount != null
									? data.data.currentLedger.consumedAmount.toLocaleString()
									: "-"}
							</div>
						</div>
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								Reserved
							</div>
							<div className="font-semibold text-lg">
								{data.data.currentLedger?.reservedAmount != null
									? data.data.currentLedger.reservedAmount.toLocaleString()
									: "-"}
							</div>
						</div>
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								Remaining
							</div>
							<div className="font-semibold text-lg">
								{data.data.currentLedger?.remainingAmount != null
									? data.data.currentLedger.remainingAmount.toLocaleString()
									: "-"}
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-lg border p-4">
					<div className="mb-3 font-medium">Adjust Budget</div>
					<form
						className="flex items-end gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							budgetForm.handleSubmit();
						}}
					>
						<div className="w-80">
							<budgetForm.AppField
								name="budgetAmount"
								children={(field) => (
									<field.TextField
										label="New budget amount"
										type="number"
										min={1}
										description="Remaining updates immediately: max(0, budget - reserved - consumed)."
									/>
								)}
							/>
						</div>
						<Button type="submit">Update Budget</Button>
					</form>
				</div>

				<div className="rounded-lg border p-4">
					<div className="mb-3 font-medium">Eligible Groups</div>
					<div className="space-y-2">
						{data.data.assignments.map((assignment) => {
							const group = groupById.get(assignment.groupId as GroupId);
							const displayName = group
								? group.kind === "system"
									? `${group.name} (system)`
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
								No groups assigned.
							</div>
						)}
					</div>
				</div>

				<div className="rounded-lg border p-4">
					<div className="mb-3 font-medium">Recent Usage Events</div>
					<div className="space-y-2">
						{data.data.recentEvents.map((event) => (
							<div
								key={event.id}
								className="grid grid-cols-[140px_1fr_120px_120px] items-center gap-3 rounded border px-3 py-2 text-sm"
							>
								<div className="uppercase">{event.eventType}</div>
								<div className="truncate text-muted-foreground">
									{event.appRequestId}
								</div>
								<div className="text-right">
									{event.reservedAmount?.toLocaleString()}
								</div>
								<div className="text-right">
									{event.actualAmount?.toLocaleString()}
								</div>
							</div>
						))}
						{data.data.recentEvents.length === 0 && (
							<div className="text-muted-foreground text-sm">
								No usage events yet.
							</div>
						)}
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
