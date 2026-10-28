import { z } from "zod/v4";
import { groupListRowSchema } from "../group/views";
import { modelSchema } from "../model/schema";
import { providerMeteringModeSchema } from "../provider/parts/metering-mode";
import { providerSchema } from "../provider/schema";
import { usageBotSchema, usagePersonSchema } from "../usage/identity";
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
		kind: true,
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
		quotaPoolGroupAssignmentSchema
			.pick({
				id: true,
				groupId: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			})
			.extend({
				group: groupListRowSchema.pick({
					id: true,
					name: true,
					description: true,
					kind: true,
					systemKey: true,
					memberCount: true,
				}),
			}),
	),
});

export const quotaUsageEventListRowSchema = quotaUsageEventSchema
	.pick({
		id: true,
		eventType: true,
		appRequestId: true,
		reservedAmount: true,
		actualAmount: true,
		totalTokens: true,
		occurredAt: true,
	})
	.extend({
		user: usagePersonSchema,
		model: modelSchema
			.pick({
				id: true,
				name: true,
			})
			.nullable(),
		bot: usageBotSchema,
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

export const quotaAvailabilitySchema = z.object({
	available: z.boolean(),
});

export type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;
export type QuotaPoolDetail = z.infer<typeof quotaPoolDetailSchema>;
export type QuotaUsageEventListRow = z.infer<
	typeof quotaUsageEventListRowSchema
>;
export type QuotaChatBadge = z.infer<typeof quotaChatBadgeSchema>;
export type QuotaAvailability = z.infer<typeof quotaAvailabilitySchema>;
