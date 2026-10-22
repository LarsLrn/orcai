import { ANALYTICS_RANGE_DAYS, type AnalyticsDays } from "@orcai/schema";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { m } from "@/paraglide/messages";

export const AnalyticsRange = ({
	days,
	onChange,
}: {
	days: AnalyticsDays;
	onChange: (days: AnalyticsDays) => void;
}) => (
	<ToggleGroup
		aria-label={m.analytics_range_label()}
		value={[
			String(days),
		]}
		onValueChange={(value) => {
			const next = ANALYTICS_RANGE_DAYS.find(
				(candidate) => String(candidate) === value[0],
			);
			if (next) {
				onChange(next);
			}
		}}
		variant="outline"
		size="sm"
	>
		{ANALYTICS_RANGE_DAYS.map((option) => (
			<ToggleGroupItem key={option} value={String(option)}>
				{m.analytics_range_days_option({
					days: option,
				})}
			</ToggleGroupItem>
		))}
	</ToggleGroup>
);
