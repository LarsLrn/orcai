import { z } from "zod/v4";

export const quotaPeriodStatusSchema = z.enum([
	"open",
	"closed",
]);

export type QuotaPeriodStatus = z.infer<typeof quotaPeriodStatusSchema>;
