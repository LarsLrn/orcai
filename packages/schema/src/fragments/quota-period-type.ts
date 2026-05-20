import { z } from "zod/v4";

export const quotaPoolPeriodTypeSchema = z.enum([
	"weekly",
	"monthly",
	"yearly",
]);

export type QuotaPoolPeriodType = z.infer<typeof quotaPoolPeriodTypeSchema>;
