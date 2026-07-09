import type { GroupId } from "@orcai/core";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod/v4";
import { MetadataCard } from "@/components/app/metadata-card";
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
				{data.data.description ? (
					<PageDescription>{data.data.description}</PageDescription>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Badge variant={data.data.isActive ? "default" : "secondary"}>
						{data.data.isActive ? "Active" : "Inactive"}
					</Badge>
					<Badge variant="outline">{data.data.periodType.toUpperCase()}</Badge>
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
			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Current Usage</CardTitle>
							<CardDescription>
								Current ledger amounts for this quota period.
							</CardDescription>
						</CardHeader>
						<CardContent>
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
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Adjust Budget</CardTitle>
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
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Eligible Groups</CardTitle>
						</CardHeader>
						<CardContent>
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
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Recent Usage Events</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Event type</TableHead>
											<TableHead>Request ID</TableHead>
											<TableHead className="text-right">
												Reserved amount
											</TableHead>
											<TableHead className="text-right">
												Actual amount
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
													{event.reservedAmount?.toLocaleString()}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{event.actualAmount?.toLocaleString()}
												</TableCell>
											</TableRow>
										))}
										{data.data.recentEvents.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={4}
													className="h-24 text-center text-muted-foreground"
												>
													No usage events yet.
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
