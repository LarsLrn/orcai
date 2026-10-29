import { z } from "zod/v4";
import { paginationInputSchema } from "../shared/pagination";
import { activityRunIdSchema } from "./ref";

export const activitySummaryInputSchema = z.object({});

export const listActivityRunsInputSchema = z.object({
	/** Older entries than this one; the newest first when left out. */
	before: activityRunIdSchema.optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	/** Only these runs, e.g. ones that just finished. */
	ids: z.array(activityRunIdSchema).max(50).optional(),
});

export const activityAttentionInputSchema = z.object({});

export const listActivityMembersInputSchema = paginationInputSchema.extend({
	runId: activityRunIdSchema,
});

export const dismissActivityRunInputSchema = z.object({
	runId: activityRunIdSchema,
});

export const dismissActivityFailureInputSchema = z.object({
	occurrenceId: z.uuid(),
});
