import { z } from "zod/v4";

export const quotaUsageEventTypeSchema = z.enum([
	"reserved",
	"finalized",
	"released",
	"failed",
]);

export type QuotaUsageEventType = z.infer<typeof quotaUsageEventTypeSchema>;
