import type { QuotaPoolPeriodType } from "@orcai/schema";
import { m } from "@/paraglide/messages";

const quotaPeriodLabels: Record<QuotaPoolPeriodType, () => string> = {
	weekly: m.quota_pools_period_weekly_label,
	monthly: m.quota_pools_period_monthly_label,
	yearly: m.quota_pools_period_yearly_label,
};

export const getQuotaPeriodLabel = (periodType: QuotaPoolPeriodType) =>
	quotaPeriodLabels[periodType]();
