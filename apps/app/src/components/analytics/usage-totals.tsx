import type { AnalyticsUsage } from "@orcai/schema";
import { Card, CardContent } from "@/components/ui/card";
import { formatCount } from "@/lib/presentation/format-number";
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
				</dl>
			</CardContent>
		</Card>
	);
};
