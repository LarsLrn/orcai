import { analyticsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChartColumnIcon } from "lucide-react";
import {
	analyticsBotKey,
	analyticsBotName,
} from "@/components/analytics/analytics-bot";
import { AnalyticsRange } from "@/components/analytics/analytics-range";
import { RatingBreakdown } from "@/components/analytics/rating-breakdown";
import {
	TwoLineName,
	UsageBreakdown,
} from "@/components/analytics/usage-breakdown";
import { UsageOverTime } from "@/components/analytics/usage-over-time";
import { UsageTotals } from "@/components/analytics/usage-totals";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/analytics/")({
	validateSearch: analyticsInputSchema,
	loaderDeps: ({ search: { days } }) => ({
		days,
	}),
	loader: async ({ context: { queryClient }, deps: { days } }) => {
		await queryClient.query(
			orpc.analytics.organization.queryOptions({
				input: {
					days,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { days } = Route.useSearch();
	const navigate = useNavigate();
	const {
		data: { data: analytics },
	} = useSuspenseQuery(
		orpc.analytics.organization.queryOptions({
			input: {
				days,
			},
		}),
	);
	const unused =
		analytics.totals.requests === 0 && analytics.ratings.length === 0;
	const hasBotUsage = analytics.bots.some((row) => row.bot.kind !== "none");

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.analytics_page_title()}</PageTitle>
				<PageDescription>{m.analytics_page_description()}</PageDescription>
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
				{unused ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ChartColumnIcon />
							</EmptyMedia>
							<EmptyTitle>{m.analytics_empty_title()}</EmptyTitle>
							<EmptyDescription>
								{m.analytics_empty_description()}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<>
						<UsageTotals totals={analytics.totals} />
						<UsageOverTime daily={analytics.daily} />
						<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
							<UsageBreakdown
								title={m.analytics_users_title()}
								description={m.analytics_users_description()}
								nameHeader={m.analytics_user_column_header()}
								rows={analytics.users}
								rowKey={(row) =>
									row.user.kind === "member" ? row.user.id : row.user.kind
								}
								name={(row) =>
									row.user.kind === "member" ? (
										<TwoLineName
											primary={row.user.name}
											secondary={row.user.email}
										/>
									) : (
										<TwoLineName primary={m.analytics_former_members_label()} />
									)
								}
								empty={m.analytics_usage_empty()}
							/>
							<UsageBreakdown
								title={m.analytics_models_title()}
								description={m.analytics_models_description()}
								nameHeader={m.analytics_model_column_header()}
								rows={analytics.models}
								rowKey={(row) => `${row.providerId}:${row.modelId ?? ""}`}
								name={(row) => (
									<TwoLineName
										primary={row.modelName ?? m.analytics_model_unknown_label()}
										secondary={row.providerName}
									/>
								)}
								empty={m.analytics_usage_empty()}
							/>
							<UsageBreakdown
								title={m.analytics_bots_title()}
								description={
									hasBotUsage
										? m.analytics_bots_description()
										: m.analytics_bots_not_recorded_description()
								}
								nameHeader={m.analytics_bot_column_header()}
								rows={analytics.bots}
								rowKey={(row) => analyticsBotKey(row.bot)}
								name={(row) => (
									<TwoLineName primary={analyticsBotName(row.bot)} />
								)}
								empty={m.analytics_usage_empty()}
							/>
							<RatingBreakdown ratings={analytics.ratings} />
						</div>
					</>
				)}
			</PageContent>
		</Page>
	);
}
