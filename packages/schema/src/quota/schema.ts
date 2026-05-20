import type {
	QuotaLedgerId,
	QuotaPeriodId,
	QuotaPoolAuditLogId,
	QuotaPoolGroupAssignmentId,
	QuotaPoolId,
	QuotaUsageEventId,
} from "@orcai/core";
import { z } from "zod/v4";
import {
	providerMeteringModeSchema,
	quotaPeriodStatusSchema,
	quotaPoolPeriodTypeSchema,
	quotaUsageEventTypeSchema,
} from "../fragments";
import { groupIdSchema } from "../group";
import { modelIdSchema } from "../model";
import { organizationIdSchema } from "../organization";
import { providerIdSchema } from "../provider";
import { createUuidIdSchema } from "../shared";
import { userIdSchema } from "../user";

export const quotaPoolIdSchema = createUuidIdSchema<QuotaPoolId>();
export const quotaPoolGroupAssignmentIdSchema =
	createUuidIdSchema<QuotaPoolGroupAssignmentId>();
export const quotaPeriodIdSchema = createUuidIdSchema<QuotaPeriodId>();
export const quotaLedgerIdSchema = createUuidIdSchema<QuotaLedgerId>();
export const quotaUsageEventIdSchema = createUuidIdSchema<QuotaUsageEventId>();
export const quotaPoolAuditLogIdSchema =
	createUuidIdSchema<QuotaPoolAuditLogId>();

export const quotaPoolFieldsSchema = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(1000).nullable().optional(),
	providerId: providerIdSchema,
	providerModelId: modelIdSchema.nullable().optional(),
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
	providerModelId: modelIdSchema.nullable(),
	createdByUserId: userIdSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const quotaPoolGroupAssignmentSchema = z.object({
	id: quotaPoolGroupAssignmentIdSchema,
	quotaPoolId: quotaPoolIdSchema,
	groupId: groupIdSchema,
	isActive: z.boolean(),
	createdByUserId: userIdSchema,
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
	providerModelId: modelIdSchema.nullable(),
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

export type QuotaPool = z.infer<typeof quotaPoolSchema>;
export type QuotaPoolGroupAssignment = z.infer<
	typeof quotaPoolGroupAssignmentSchema
>;
export type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;
export type QuotaLedger = z.infer<typeof quotaLedgerSchema>;
export type QuotaUsageEvent = z.infer<typeof quotaUsageEventSchema>;
