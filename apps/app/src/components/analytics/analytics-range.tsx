import { ANALYTICS_RANGE_DAYS, type AnalyticsDays } from "@orcai/schema";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";

/** Owns the selected range; lay its list and panel out as children of the page. */
export const AnalyticsRange = ({
	days,
	onChange,
	children,
}: {
	days: AnalyticsDays;
	onChange: (days: AnalyticsDays) => void;
	children: ReactNode;
}) => (
	<Tabs
		className="contents"
		value={String(days)}
		onValueChange={(value) => {
			const next = ANALYTICS_RANGE_DAYS.find(
				(candidate) => String(candidate) === value,
			);
			if (next) {
				onChange(next);
			}
		}}
	>
		{children}
	</Tabs>
);

export const AnalyticsRangeList = () => (
	<TabsList aria-label={m.analytics_range_label()}>
		{ANALYTICS_RANGE_DAYS.map((option) => (
			<TabsTrigger key={option} value={String(option)}>
				{m.analytics_range_days_option({
					days: option,
				})}
			</TabsTrigger>
		))}
	</TabsList>
);

export const AnalyticsRangePanel = ({
	days,
	children,
}: {
	days: AnalyticsDays;
	children: ReactNode;
}) => (
	<TabsContent value={String(days)} className="space-y-6 text-base">
		{children}
	</TabsContent>
);
