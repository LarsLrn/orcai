import { dbSchema } from "@orcai/db/schema";
import {
	chatIdSchema,
	groupIdSchema,
	modelIdSchema,
	organizationIdSchema,
	paginationInputSchema,
	providerMeteringModeSchema,
	quotaPeriodIdSchema,
	quotaPoolIdSchema,
} from "@orcai/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { providerSelectSchema } from "./provider";

export const quotaPoolSelectSchema = createSelectSchema(dbSchema.quotaPool, {
	id: quotaPoolIdSchema,
	organizationId: organizationIdSchema,
});
export const quotaPoolGroupAssignmentSelectSchema = createSelectSchema(
	dbSchema.quotaPoolGroupAssignment,
	{
		groupId: groupIdSchema,
	},
);
export const quotaPeriodSelectSchema = createSelectSchema(
	dbSchema.quotaPeriod,
	{
		id: quotaPeriodIdSchema,
	},
);
export const quotaLedgerSelectSchema = createSelectSchema(dbSchema.quotaLedger);
export const quotaUsageEventSelectSchema = createSelectSchema(
	dbSchema.quotaUsageEvent,
);

export const quotaPoolListInputSchema = paginationInputSchema.extend({
	filters: z
		.object({
			providerId: providerSelectSchema.shape.id.optional(),
			search: z.string().trim().max(120).optional(),
			isActive: z.boolean().optional(),
		})
		.optional(),
});

export const quotaPoolCreateInputSchema = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(1000).nullable().optional(),
	providerId: providerSelectSchema.shape.id,
	providerModelId: modelIdSchema.nullable().optional(),
	periodType: quotaPoolSelectSchema.shape.periodType,
	budgetAmount: z.coerce.number().int().positive(),
	priority: z.coerce.number().int().default(0),
	isDefault: z.boolean().default(false),
	isActive: z.boolean().default(true),
	groupIds: z.array(groupIdSchema).min(1).max(500),
});

export const quotaPoolUpdateInputSchema = z.object({
	id: quotaPoolIdSchema,
	name: z.string().trim().min(1).max(120).optional(),
	description: z.string().trim().max(1000).nullable().optional(),
	providerModelId: modelIdSchema.nullable().optional(),
	periodType: quotaPoolSelectSchema.shape.periodType.optional(),
	budgetAmount: z.coerce.number().int().positive().optional(),
	priority: z.coerce.number().int().optional(),
	isDefault: z.boolean().optional(),
	isActive: z.boolean().optional(),
	groupIds: z.array(groupIdSchema).min(1).max(500).optional(),
});

export const quotaPoolDeactivateInputSchema = z.object({
	id: quotaPoolIdSchema,
});

export const quotaPoolFindInputSchema = z.object({
	id: quotaPoolIdSchema,
});

export const quotaPoolListRowSchema = quotaPoolSelectSchema.extend({
	provider: providerSelectSchema.pick({
		id: true,
		name: true,
		compatibility: true,
		meteringMode: true,
	}),
	currentPeriod: quotaPeriodSelectSchema
		.pick({
			id: true,
			startsAt: true,
			endsAt: true,
			status: true,
		})
		.nullable(),
	currentLedger: quotaLedgerSelectSchema
		.pick({
			budgetAmount: true,
			reservedAmount: true,
			consumedAmount: true,
			remainingAmount: true,
			updatedAt: true,
		})
		.nullable(),
});

export const quotaPoolListResponseSchema = z.object({
	data: z.array(quotaPoolListRowSchema),
	rowCount: z.number(),
});

export const quotaPoolFindResponseSchema = z.object({
	data: quotaPoolListRowSchema.extend({
		assignments: z.array(
			quotaPoolGroupAssignmentSelectSchema.pick({
				id: true,
				groupId: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			}),
		),
		recentEvents: z.array(
			quotaUsageEventSelectSchema.pick({
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
	}),
});

export const quotaPoolWriteResponseSchema = z.object({
	data: quotaPoolSelectSchema,
});

export const quotaChatBadgeInputSchema = z.object({
	chatId: chatIdSchema,
});

export const quotaChatBadgeResponseSchema = z.object({
	data: z.object({
		poolId: quotaPoolIdSchema.nullable(),
		poolName: z.string().nullable(),
		meteringMode: providerMeteringModeSchema.nullable(),
		remainingAmount: z.number().nullable(),
		consumedAmount: z.number().nullable(),
		reservedAmount: z.number().nullable(),
		periodEndsAt: z.coerce.date().nullable(),
	}),
});
