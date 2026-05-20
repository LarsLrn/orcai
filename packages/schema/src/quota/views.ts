import { z } from "zod/v4";
import { providerMeteringModeSchema } from "../fragments/provider-metering-mode";
import { providerSchema } from "../provider/schema";
import { quotaPoolIdSchema } from "./ref";
import {
	quotaLedgerSchema,
	quotaPeriodSchema,
	quotaPoolGroupAssignmentSchema,
	quotaPoolSchema,
	quotaUsageEventSchema,
} from "./schema";

export const quotaPoolListRowSchema = quotaPoolSchema.extend({
	provider: providerSchema.pick({
		id: true,
		name: true,
		compatibility: true,
		meteringMode: true,
	}),
	currentPeriod: quotaPeriodSchema
		.pick({
			id: true,
			startsAt: true,
			endsAt: true,
			status: true,
		})
		.nullable(),
	currentLedger: quotaLedgerSchema
		.pick({
			budgetAmount: true,
			reservedAmount: true,
			consumedAmount: true,
			remainingAmount: true,
			updatedAt: true,
		})
		.nullable(),
});

export const quotaPoolDetailSchema = quotaPoolListRowSchema.extend({
	assignments: z.array(
		quotaPoolGroupAssignmentSchema.pick({
			id: true,
			groupId: true,
			isActive: true,
			createdAt: true,
			updatedAt: true,
		}),
	),
	recentEvents: z.array(
		quotaUsageEventSchema.pick({
			id: true,
			eventType: true,
			reservationKey: true,
			appRequestId: true,
			userId: true,
			reservedAmount: true,
			actualAmount: true,
			requestCount: true,
			totalTokens: true,
			occurredAt: true,
		}),
	),
});

export const quotaChatBadgeSchema = z.object({
	poolId: quotaPoolIdSchema.nullable(),
	poolName: z.string().nullable(),
	meteringMode: providerMeteringModeSchema.nullable(),
	remainingAmount: z.number().nullable(),
	consumedAmount: z.number().nullable(),
	reservedAmount: z.number().nullable(),
	periodEndsAt: z.coerce.date().nullable(),
});

export type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;
export type QuotaPoolDetail = z.infer<typeof quotaPoolDetailSchema>;
export type QuotaChatBadge = z.infer<typeof quotaChatBadgeSchema>;
