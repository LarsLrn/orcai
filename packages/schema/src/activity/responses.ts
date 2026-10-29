import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { blockIdSchema } from "../block/ref";
import { dataExportIdSchema } from "../data-export/ref";
import { dataExportStatusSchema } from "../data-export/schema";
import { organizationIdSchema } from "../organization/ref";
import { pipelineFailureSchema } from "../shared/primitives/pipeline-status";
import { activityRunIdSchema } from "./ref";
import {
	activityRunKindSchema,
	activityStageSchema,
	activityStageStateSchema,
} from "./schema";

const namedOrganizationSchema = z.object({
	id: organizationIdSchema,
	name: z.string(),
});

const namedRepositorySchema = z.object({
	id: blockIdSchema,
	name: z.string(),
});

const namedAssetSchema = z.object({
	id: assetIdSchema,
	title: z.string(),
});

/**
 * How a run went: `failed` while one of its failures is not repaired,
 * `resolved` once every failure was repaired, `expired` for an export whose
 * download is gone.
 */
export const activityRunStateSchema = z.enum([
	"running",
	"finished",
	"failed",
	"resolved",
	"expired",
]);

/** One entry in the user's activity: an action and how its work went. */
export const activityRunSchema = z.object({
	id: activityRunIdSchema,
	kind: activityRunKindSchema,
	state: activityRunStateSchema,
	createdAt: z.coerce.date(),
	organization: namedOrganizationSchema.nullable(),
	repository: namedRepositorySchema.nullable(),
	/** The asset, when the run worked on one. */
	asset: namedAssetSchema.nullable(),
	/** Counted over the members the user may read. */
	progress: z.object({
		total: z.number().int(),
		done: z.number().int(),
		failed: z.number().int(),
	}),
	/** For a metadata run: assets it filled fields on, and those it left unchanged. */
	metadata: z
		.object({
			updated: z.number().int(),
			unchanged: z.number().int(),
		})
		.nullable(),
	dataExport: z
		.object({
			id: dataExportIdSchema,
			status: dataExportStatusSchema,
		})
		.nullable(),
});

export const activityMemberSchema = z.object({
	asset: namedAssetSchema,
	/** Each stage of the run's work on the asset; null when not the run's work or not readable. */
	processing: activityStageStateSchema.nullable(),
	metadata: activityStageStateSchema.nullable(),
	indexing: activityStageStateSchema.nullable(),
	/** The fields the run's metadata generation filled; null before it applied. */
	appliedFields: z.array(z.string()).nullable(),
});

/** A failure that needs the user, until it is repaired or they dismiss it. */
export const activityFailureSchema = z.object({
	occurrenceId: z.uuid(),
	stage: activityStageSchema,
	failure: pipelineFailureSchema.nullable(),
	asset: namedAssetSchema.nullable(),
	repository: namedRepositorySchema.nullable(),
	dataExportId: dataExportIdSchema.nullable(),
	organization: namedOrganizationSchema.nullable(),
});

export const activitySuggestionsSchema = z.object({
	organization: namedOrganizationSchema,
	count: z.number().int(),
});

export const activitySummaryResponseSchema = z.object({
	running: z.array(activityRunSchema),
	attention: z.object({
		suggestions: z.number().int(),
		failures: z.number().int(),
		/** Changes whenever the attention list does, also when its counts stay the same. */
		revision: z.string(),
	}),
});

export const listActivityRunsResponseSchema = z.object({
	data: z.array(activityRunSchema),
	hasMore: z.boolean(),
});

export const activityAttentionResponseSchema = z.object({
	/** Pending suggestions the user can review, per organisation. */
	suggestions: z.array(activitySuggestionsSchema),
	failures: z.array(activityFailureSchema),
});

export const listActivityMembersResponseSchema = z.object({
	data: z.array(activityMemberSchema),
	rowCount: z.number().int(),
	/** For a metadata run: how many assets got each field. */
	fields: z.record(z.string(), z.number().int()),
});

export type ActivityRunState = z.infer<typeof activityRunStateSchema>;
export type ActivityRun = z.infer<typeof activityRunSchema>;
export type ActivityMember = z.infer<typeof activityMemberSchema>;
export type ActivityFailure = z.infer<typeof activityFailureSchema>;
