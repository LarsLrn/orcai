import { z } from "zod/v4";
import { groupListRowSchema } from "../group/views";
import { modelSchema } from "../model/schema";
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

/** The pool covering a user for a model, as a share; amounts stay on the pool page. */
export const quotaStatusSchema = z.object({
	available: z.boolean(),
	pool: z
		.object({
			id: quotaPoolIdSchema,
			name: z.string(),
			/** Consumed and reserved over budget, 0 to 1. */
			usedShare: z.number(),
			periodEndsAt: z.coerce.date(),
		})
		.nullable(),
});

export type QuotaPoolListRow = z.infer<typeof quotaPoolListRowSchema>;
export type QuotaPoolDetail = z.infer<typeof quotaPoolDetailSchema>;
export type QuotaUsageEventListRow = z.infer<
	typeof quotaUsageEventListRowSchema
>;
export type QuotaStatus = z.infer<typeof quotaStatusSchema>;
