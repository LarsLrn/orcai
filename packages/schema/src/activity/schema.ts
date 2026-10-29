import { z } from "zod/v4";

/** What a user started: one entry in their activity. */
export const ACTIVITY_RUN_KINDS = [
	"upload",
	"fill_metadata",
	"suggest_metadata",
	"retry",
	"export",
] as const;

export const activityRunKindSchema = z.enum(ACTIVITY_RUN_KINDS);

export type ActivityRunKind = z.infer<typeof activityRunKindSchema>;

/** A stage of the work a run admitted for one asset or export. */
export const ACTIVITY_STAGES = [
	"processing",
	"indexing",
	"metadata",
	"export",
] as const;

export const activityStageSchema = z.enum(ACTIVITY_STAGES);

export type ActivityStage = z.infer<typeof activityStageSchema>;

/** How a run's stage of one member went; `replaced` when later work took it over. */
export const ACTIVITY_STAGE_STATES = [
	"pending",
	"completed",
	"failed",
	"replaced",
] as const;

export const activityStageStateSchema = z.enum(ACTIVITY_STAGE_STATES);

export type ActivityStageState = z.infer<typeof activityStageStateSchema>;
