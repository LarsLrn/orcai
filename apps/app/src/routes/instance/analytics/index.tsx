import { analyticsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalyticsRange } from "@/components/analytics/analytics-range";
import {
	TwoLineName,
	UsageBreakdown,
} from "@/components/analytics/usage-breakdown";
import { UsageOverTime } from "@/components/analytics/usage-over-time";
import { UsageTotals } from "@/components/analytics/usage-totals";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/instance/analytics/")({
	validateSearch: analyticsInputSchema,
	loaderDeps: ({ search: { days } }) => ({
		days,
	}),
	loader: async ({ context: { queryClient }, deps: { days } }) => {
		await queryClient.query(
			orpc.analytics.instance.queryOptions({
				input: {
					days,
				},
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.instance_analytics_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { days } = Route.useSearch();
	const navigate = useNavigate();
	const {
		data: { data: analytics },
	} = useSuspenseQuery(
		orpc.analytics.instance.queryOptions({
			input: {
				days,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.instance_analytics_page_title()}</PageTitle>
				<PageDescription>
					{m.instance_analytics_page_description()}
				</PageDescription>
				<PageAction>
					<AnalyticsRange
						days={days}
						onChange={(next) =>
							void navigate({
								to: ".",
								search: {
									days: next,
								},
								replace: true,
							})
						}
					/>
				</PageAction>
			</PageHeader>
			<PageContent className="space-y-6">
				<UsageTotals totals={analytics.totals} />
				<UsageOverTime daily={analytics.daily} />
				<UsageBreakdown
					title={m.instance_analytics_organizations_title()}
					description={m.instance_analytics_organizations_description()}
					nameHeader={m.instance_analytics_organization_column_header()}
					rows={analytics.organizations}
					rowKey={(row) => row.organizationId}
					name={(row) => (
						<TwoLineName primary={row.name} secondary={row.slug} />
					)}
					columns={[
						{
							header: m.instance_analytics_active_users_column_header(),
							cell: (row) => formatCount(row.activeUsers),
						},
					]}
					empty={m.instance_organizations_empty_title()}
				/>
			</PageContent>
		</Page>
	);
}
