import type { AnalyticsDayUsage } from "@orcai/schema";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCompactNumber } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const useDayLabel = () =>
	useMemo(() => {
		const format = new Intl.DateTimeFormat(getLocale(), {
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		});
		return (date: unknown) =>
			typeof date === "string" ? format.format(new Date(date)) : "";
	}, []);

const UsageChart = ({
	title,
	description,
	config,
	daily,
	stacked,
	decimals = false,
}: {
	title: string;
	description: string;
	config: ChartConfig;
	daily: {
		date: string;
	}[];
	stacked?: boolean;
	decimals?: boolean;
}) => {
	const dayLabel = useDayLabel();
	const keys = Object.keys(config);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={config} className="aspect-auto h-64 w-full">
					<BarChart accessibilityLayer data={daily}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={24}
							tickFormatter={dayLabel}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={48}
							allowDecimals={decimals}
							tickFormatter={(value: number) => formatCompactNumber(value)}
						/>
						<ChartTooltip
							content={<ChartTooltipContent labelFormatter={dayLabel} />}
						/>
						{keys.length > 1 ? (
							<ChartLegend content={<ChartLegendContent />} />
						) : null}
						{keys.map((key, index) => (
							<Bar
								key={key}
								dataKey={key}
								stackId={stacked ? "usage" : undefined}
								fill={`var(--color-${key})`}
								radius={
									stacked && index < keys.length - 1
										? 0
										: [
												4,
												4,
												0,
												0,
											]
								}
							/>
						))}
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
};

/** Each day's cost in units of each currency, one series per currency. */
const dailyCosts = (daily: AnalyticsDayUsage[]) => {
	const currencies = [
		...new Set(
			daily.flatMap(({ cost }) => cost.map(({ currency }) => currency)),
		),
	].sort();
	return {
		config: Object.fromEntries(
			currencies.map((currency, index) => [
				currency,
				{
					label: currency,
					color: `var(--chart-${(index % 5) + 1})`,
				},
			]),
		) satisfies ChartConfig,
		data: daily.map(({ date, cost }) => ({
			date,
			...Object.fromEntries(
				cost.map(({ currency, amount }) => [
					currency,
					amount / 1_000_000,
				]),
			),
		})),
	};
};

export const UsageOverTime = ({ daily }: { daily: AnalyticsDayUsage[] }) => {
	const costs = dailyCosts(daily);

	return (
		<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<UsageChart
				title={m.analytics_tokens_chart_title()}
				description={m.analytics_tokens_chart_description()}
				daily={daily}
				stacked
				config={{
					inputTokens: {
						label: m.analytics_metric_input_tokens(),
						color: "var(--chart-1)",
					},
					outputTokens: {
						label: m.analytics_metric_output_tokens(),
						color: "var(--chart-2)",
					},
				}}
			/>
			<UsageChart
				title={m.analytics_requests_chart_title()}
				description={m.analytics_requests_chart_description()}
				daily={daily}
				config={{
					requests: {
						label: m.analytics_metric_requests(),
						color: "var(--chart-3)",
					},
				}}
			/>
			{Object.keys(costs.config).length > 0 && (
				<UsageChart
					title={m.analytics_cost_chart_title()}
					description={m.analytics_cost_chart_description()}
					daily={costs.data}
					config={costs.config}
					decimals
				/>
			)}
		</div>
	);
};
