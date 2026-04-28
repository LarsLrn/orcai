import { z } from "zod/v4";
import {
	PROCESS_ASSET_JOB_NAME,
	QUOTA_DAILY_VERIFY_JOB_NAME,
	QUOTA_PERIOD_ROLLOVER_JOB_NAME,
	QUOTA_RECONCILE_JOB_NAME,
	VECTORIZE_ASSET_JOB_NAME,
} from "./job-queues";
import {
	processAssetOutputSchema,
	processAssetPayloadSchema,
} from "./process-asset";
import {
	vectorizeAssetOutputSchema,
	vectorizeAssetPayloadSchema,
} from "./vectorize-asset";

export const jobStateSchema = z.enum([
	"created",
	"retry",
	"active",
	"completed",
	"cancelled",
	"failed",
]);

export const baseJobHistoryEntrySchema = z.object({
	id: z.uuidv4(),
	priority: z.number().int(),
	state: jobStateSchema,
	retryLimit: z.int(),
	retryCount: z.int(),
	retryDelay: z.int(),
	retryBackoff: z.boolean().default(false),
	retryDelayMax: z.int().nullable().optional(),
	singletonKey: z.string().nullable().optional(),
	singletonOn: z.date().nullable().optional(),
	startAfter: z.date(),
	createdOn: z.date(),
	startedOn: z.date().nullable().optional(),
	completedOn: z.date().nullable().optional(),
	keepUntil: z.date(),
	deadLetter: z.string().nullable().optional(),
	policy: z.string().nullable().optional(),
});

export const processAssetJobHistoryEntrySchema =
	baseJobHistoryEntrySchema.extend({
		name: z.literal(PROCESS_ASSET_JOB_NAME),
		data: processAssetPayloadSchema,
		output: processAssetOutputSchema.nullable().optional(),
	});

export const vectorizeAssetJobHistoryEntrySchema =
	baseJobHistoryEntrySchema.extend({
		name: z.literal(VECTORIZE_ASSET_JOB_NAME),
		data: vectorizeAssetPayloadSchema,
		output: vectorizeAssetOutputSchema.nullable().optional(),
	});

const genericJobDataSchema = z.record(z.string(), z.unknown());
const genericJobOutputSchema = z.unknown().nullable().optional();

export const quotaPeriodRolloverJobHistoryEntrySchema =
	baseJobHistoryEntrySchema.extend({
		name: z.literal(QUOTA_PERIOD_ROLLOVER_JOB_NAME),
		data: genericJobDataSchema,
		output: genericJobOutputSchema,
	});

export const quotaReconcileJobHistoryEntrySchema =
	baseJobHistoryEntrySchema.extend({
		name: z.literal(QUOTA_RECONCILE_JOB_NAME),
		data: genericJobDataSchema,
		output: genericJobOutputSchema,
	});

export const quotaDailyVerifyJobHistoryEntrySchema =
	baseJobHistoryEntrySchema.extend({
		name: z.literal(QUOTA_DAILY_VERIFY_JOB_NAME),
		data: genericJobDataSchema,
		output: genericJobOutputSchema,
	});

export const jobHistoryEntrySchema = z.discriminatedUnion("name", [
	processAssetJobHistoryEntrySchema,
	vectorizeAssetJobHistoryEntrySchema,
	quotaPeriodRolloverJobHistoryEntrySchema,
	quotaReconcileJobHistoryEntrySchema,
	quotaDailyVerifyJobHistoryEntrySchema,
]);

export type JobState = z.infer<typeof jobStateSchema>;
export type JobHistoryEntry = z.infer<typeof jobHistoryEntrySchema>;
