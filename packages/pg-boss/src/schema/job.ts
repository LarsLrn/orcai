import {
	PROCESS_ASSET_JOB_NAME,
	processAssetOutputSchema,
	processAssetPayloadSchema,
	VECTORIZE_ASSET_JOB_NAME,
	vectorizeAssetOutputSchema,
	vectorizeAssetPayloadSchema,
} from "@orcai/schema";
import { states } from "pg-boss";
import { z } from "zod/v4";

export const jobState = z.enum([
	states.created,
	states.retry,
	states.active,
	states.completed,
	states.cancelled,
	states.failed,
]);

export const baseJobSchema = z.object({
	id: z.uuidv4(),
	priority: z.number().int(),
	state: jobState,
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

// --- Specific Job Definitions ---

export const processAssetJobSchema = baseJobSchema.extend({
	name: z.literal(PROCESS_ASSET_JOB_NAME),
	data: processAssetPayloadSchema,
	output: processAssetOutputSchema.nullable().optional(),
});

export const vectorizeAssetJobSchema = baseJobSchema.extend({
	name: z.literal(VECTORIZE_ASSET_JOB_NAME),
	data: vectorizeAssetPayloadSchema,
	// TODO: consider discriminated union based on job state
	output: vectorizeAssetOutputSchema.nullable().optional(),
});

// --- Discriminated Union ---

export const jobSchema = z.discriminatedUnion("name", [
	processAssetJobSchema,
	vectorizeAssetJobSchema,
]);

export type Job = z.infer<typeof jobSchema>;
