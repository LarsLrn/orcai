import type {
	ActivityRunId,
	AssetId,
	BlockId,
	DataExportId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import {
	ACTIVITY_RUN_KINDS,
	ACTIVITY_STAGE_STATES,
	type AppliedMetadataField,
} from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { asset } from "./asset";
import { user } from "./auth";
import { block } from "./block";
import { dataExport } from "./data-export";
import { organization } from "./organization";

export const activityRunKindEnum = pgEnum(
	"activity_run_kind",
	ACTIVITY_RUN_KINDS,
);

export const activityStageStateEnum = pgEnum(
	"activity_stage_state",
	ACTIVITY_STAGE_STATES,
);

/**
 * Background work one user started: an upload, a metadata backfill, a retry,
 * an export. Its progress is read from its members.
 */
export const activityRun = pgTable(
	"activity_run",
	{
		id: uuid("id").$type<ActivityRunId>().primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		kind: activityRunKindEnum("kind").notNull(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		/** The repository the run indexes in; set once. */
		blockId: uuid("block_id")
			.$type<BlockId>()
			.references(() => block.id, {
				onDelete: "set null",
			}),
		/** The client's key for an upload, so a repeated call joins its run. */
		clientKey: uuid("client_key"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		/** When the cleanup first found it finished; retention counts from it. */
		finishedSeenAt: timestamp("finished_seen_at"),
		dismissedAt: timestamp("dismissed_at"),
	},
	(table) => [
		unique("activity_run_client_key_unique").on(table.userId, table.clientKey),
		index("activity_run_user_created_idx").on(table.userId, table.createdAt),
	],
);

/**
 * One call still adding members to an upload run. The run counts as running
 * while any lease lasts; a crashed call's lease runs out.
 */
export const activityAdmission = pgTable(
	"activity_admission",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.$type<ActivityRunId>()
			.notNull()
			.references(() => activityRun.id, {
				onDelete: "cascade",
			}),
		leaseUntil: timestamp("lease_until").notNull(),
	},
	(table) => [
		index("activity_admission_run_idx").on(table.runId),
	],
);

/**
 * An asset or export a run took on, the repository it indexes the asset in,
 * and how each stage of the run's work on it went. A stage that is not the
 * run's work stays null.
 */
export const activityMember = pgTable(
	"activity_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.$type<ActivityRunId>()
			.notNull()
			.references(() => activityRun.id, {
				onDelete: "cascade",
			}),
		assetId: uuid("asset_id")
			.$type<AssetId>()
			.references(() => asset.id, {
				onDelete: "cascade",
			}),
		blockId: uuid("block_id")
			.$type<BlockId>()
			.references(() => block.id, {
				onDelete: "set null",
			}),
		dataExportId: uuid("data_export_id")
			.$type<DataExportId>()
			.references(() => dataExport.id, {
				onDelete: "cascade",
			}),
		processingState: activityStageStateEnum("processing_state"),
		processingFailureId: uuid("processing_failure_id"),
		metadataState: activityStageStateEnum("metadata_state"),
		metadataFailureId: uuid("metadata_failure_id"),
		indexingState: activityStageStateEnum("indexing_state"),
		indexingFailureId: uuid("indexing_failure_id"),
		/** The fields the run's metadata generation filled, once it applied. */
		appliedFields: text("applied_fields").$type<AppliedMetadataField>().array(),
	},
	(table) => [
		check(
			"activity_member_target_check",
			sql`(${table.assetId} is null) <> (${table.dataExportId} is null) and (${table.blockId} is null or ${table.assetId} is not null)`,
		),
		uniqueIndex("activity_member_asset_unique")
			.on(table.runId, table.assetId)
			.where(sql`${table.assetId} is not null`),
		uniqueIndex("activity_member_export_unique")
			.on(table.dataExportId)
			.where(sql`${table.dataExportId} is not null`),
		index("activity_member_pending_idx")
			.on(table.runId)
			.where(
				sql`'pending' in (${table.processingState}, ${table.metadataState}, ${table.indexingState})`,
			),
		index("activity_member_asset_idx").on(table.assetId),
	],
);

/**
 * A user dismissed one failure: a processing, metadata or indexing failure
 * id, or a failed export's id. The next failure of the same target has a new
 * id and shows again.
 */
export const activityDismissal = pgTable(
	"activity_dismissal",
	{
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		occurrenceId: uuid("occurrence_id").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.userId,
				table.occurrenceId,
			],
		}),
	],
);
