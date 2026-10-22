import type { AnalyticsUsage } from "@orcai/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatCosts, formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

export const UsageTotals = ({ totals }: { totals: AnalyticsUsage }) => {
	const metrics = [
		[
			m.analytics_metric_total_tokens(),
			totals.totalTokens,
		],
		[
			m.analytics_metric_input_tokens(),
			totals.inputTokens,
		],
		[
			m.analytics_metric_output_tokens(),
			totals.outputTokens,
		],
		[
			m.analytics_metric_requests(),
			totals.requests,
		],
		[
			m.analytics_metric_cache_read_tokens(),
			totals.cacheReadTokens,
		],
		[
			m.analytics_metric_cache_write_tokens(),
			totals.cacheWriteTokens,
		],
	] as const;

	return (
		<Card>
			<CardContent className="@container">
				<dl className="grid @2xl:grid-cols-4 grid-cols-2 gap-4">
					{metrics.map(([label, value]) => (
						<div key={label}>
							<dt className="text-muted-foreground text-xs uppercase">
								{label}
							</dt>
							<dd className="font-semibold text-lg tabular-nums">
								{formatCount(value)}
							</dd>
						</div>
					))}
					<div className="@2xl:col-span-2 col-span-2">
						<dt className="text-muted-foreground text-xs uppercase">
							{m.analytics_metric_cost()}
						</dt>
						<dd className="font-semibold text-lg tabular-nums">
							{formatCosts(totals.cost, m.analytics_cost_none())}
						</dd>
						{totals.unpriced > 0 && (
							<dd className="text-muted-foreground text-sm">
								{m.analytics_cost_unpriced({
									count: formatCount(totals.unpriced),
								})}
							</dd>
						)}
					</div>
				</dl>
			</CardContent>
			<CardFooter className="text-muted-foreground text-xs">
				{m.analytics_cost_notice()}
			</CardFooter>
		</Card>
	);
};
