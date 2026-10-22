import { z } from "zod/v4";

export const ANALYTICS_RANGE_DAYS = [
	7,
	30,
	90,
] as const;

export const analyticsDaysSchema = z.coerce
	.number()
	.pipe(z.union(ANALYTICS_RANGE_DAYS.map((days) => z.literal(days))));

export const analyticsInputSchema = z.object({
	days: analyticsDaysSchema.default(30),
});

export type AnalyticsDays = z.infer<typeof analyticsDaysSchema>;
