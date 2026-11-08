import { z } from "zod/v4";
import { providerMeteringModeSchema } from "../provider/schema";
import {
	groupIdSchema,
	modelIdSchema,
	organizationIdSchema,
	providerIdSchema,
	quotaLedgerIdSchema,
	quotaPeriodIdSchema,
	quotaPoolGroupAssignmentIdSchema,
	quotaPoolIdSchema,
	quotaUsageEventIdSchema,
	userIdSchema,
} from "../shared/ids";

export const QUOTA_PERIOD_STATUSES = [
	"open",
	"closed",
] as const;

const quotaPeriodStatusSchema = z.enum(QUOTA_PERIOD_STATUSES);

export const QUOTA_POOL_PERIOD_TYPES = [
	"weekly",
	"monthly",
	"yearly",
] as const;

const quotaPoolPeriodTypeSchema = z.enum(QUOTA_POOL_PERIOD_TYPES);

export type QuotaPoolPeriodType = z.infer<typeof quotaPoolPeriodTypeSchema>;

export const QUOTA_USAGE_EVENT_TYPES = [
	"reserved",
	"finalized",
	"released",
	"failed",
] as const;

export const quotaUsageEventTypeSchema = z.enum(QUOTA_USAGE_EVENT_TYPES);

export type QuotaUsageEventType = z.infer<typeof quotaUsageEventTypeSchema>;

export const quotaPoolFieldsSchema = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(1000).nullable().optional(),
	providerId: providerIdSchema,
	modelId: modelIdSchema.nullable().optional(),
	periodType: quotaPoolPeriodTypeSchema,
	budgetAmount: z.coerce.number().int().positive(),
	priority: z.coerce.number().int().default(0),
	isDefault: z.boolean().default(false),
	isActive: z.boolean().default(true),
});

export const quotaPoolMutableFieldsSchema = quotaPoolFieldsSchema
	.omit({
		providerId: true,
	})
	.partial();

export const quotaPoolFiltersSchema = z.object({
	providerId: providerIdSchema.optional(),
	search: z.string().trim().max(120).optional(),
	isActive: z.boolean().optional(),
});

export const quotaPoolSchema = quotaPoolFieldsSchema.extend({
	id: quotaPoolIdSchema,
	organizationId: organizationIdSchema,
	description: z.string().nullable(),
	modelId: modelIdSchema.nullable(),
	createdByUserId: userIdSchema.nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const quotaPoolGroupAssignmentSchema = z.object({
	id: quotaPoolGroupAssignmentIdSchema,
	quotaPoolId: quotaPoolIdSchema,
	groupId: groupIdSchema,
	isActive: z.boolean(),
	createdByUserId: userIdSchema.nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const quotaPeriodSchema = z.object({
	id: quotaPeriodIdSchema,
	quotaPoolId: quotaPoolIdSchema,
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	status: quotaPeriodStatusSchema,
	createdAt: z.coerce.date(),
	closedAt: z.coerce.date().nullable(),
});

export const quotaLedgerSchema = z.object({
	id: quotaLedgerIdSchema,
	quotaPoolId: quotaPoolIdSchema,
	quotaPeriodId: quotaPeriodIdSchema,
	budgetAmount: z.number(),
	reservedAmount: z.number(),
	consumedAmount: z.number(),
	remainingAmount: z.number(),
	version: z.number(),
	updatedAt: z.coerce.date(),
});

export const quotaUsageEventSchema = z.object({
	id: quotaUsageEventIdSchema,
	organizationId: organizationIdSchema,
	quotaPoolId: quotaPoolIdSchema,
	quotaPeriodId: quotaPeriodIdSchema,
	providerId: providerIdSchema,
	modelId: modelIdSchema.nullable(),
	userId: userIdSchema,
	appRequestId: z.string(),
	eventType: quotaUsageEventTypeSchema,
	reservationKey: z.string(),
	meteringMode: providerMeteringModeSchema,
	reservedAmount: z.number(),
	actualAmount: z.number(),
	requestCount: z.number().nullable(),
	inputTokens: z.number().nullable(),
	outputTokens: z.number().nullable(),
	totalTokens: z.number().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	occurredAt: z.coerce.date(),
	createdAt: z.coerce.date(),
});
