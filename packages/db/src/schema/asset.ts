import type { AssetId, UserId } from "@orcai/core";
import {
	ASSET_FILE_TYPES,
	ASSET_ORIGINS,
	type AssetMetadataType,
	type BucketName,
	type MetadataSuggestion,
	PIPELINE_FAILURES,
	PIPELINE_STATUSES,
} from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const assetFileTypeEnum = pgEnum("asset_file_type", ASSET_FILE_TYPES);

export const assetOriginEnum = pgEnum("asset_origin", ASSET_ORIGINS);

export const pipelineStatusEnum = pgEnum("pipeline_status", PIPELINE_STATUSES);

export const pipelineFailureEnum = pgEnum(
	"pipeline_failure",
	PIPELINE_FAILURES,
);

export const asset = pgTable(
	"asset",
	{
		id: uuid("id").$type<AssetId>().primaryKey().defaultRandom(),
		bucket: text("bucket").$type<BucketName>().notNull(),
		prefix: text("prefix").notNull(),
		title: text("title").notNull(),
		metadata: json("metadata").notNull().$type<AssetMetadataType>().default({}),
		size: integer("size").notNull(),
		processingStatus: pipelineStatusEnum("processing_status")
			.notNull()
			.default("pending"),
		processingFailure: pipelineFailureEnum("processing_failure"),
		/** Identifies the current processing failure; a new failure gets a new id. */
		processingFailureId: uuid("processing_failure_id"),
		/** Who asked for the current processing; null when it was automatic. */
		processingActorId: uuid("processing_actor_id")
			.$type<UserId>()
			.references(() => user.id, {
				onDelete: "set null",
			}),
		/** Counts processing requests; a delivery for an earlier one does nothing. */
		processingGeneration: integer("processing_generation").notNull().default(0),
		fileName: text("file_name"),
		metadataStatus: pipelineStatusEnum("metadata_status"),
		metadataFailure: pipelineFailureEnum("metadata_failure"),
		/** Identifies the current metadata failure; a new failure gets a new id. */
		metadataFailureId: uuid("metadata_failure_id"),
		/** Who asked for the current metadata generation; null when it was automatic. */
		metadataActorId: uuid("metadata_actor_id")
			.$type<UserId>()
			.references(() => user.id, {
				onDelete: "set null",
			}),
		metadataSuggestion: json("metadata_suggestion").$type<MetadataSuggestion>(),
		/** Counts metadata generations; a job or review for an earlier one changes nothing. */
		metadataGeneration: integer("metadata_generation").notNull().default(0),
		fileType: assetFileTypeEnum("file_type").notNull(),
		origin: assetOriginEnum("origin").notNull().default("library"),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		updatedAt: timestamp("updated_at").defaultNow(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("asset_processing_failed_owner_idx")
			.on(sql`coalesce(${table.processingActorId}, ${table.userId})`)
			.where(sql`${table.processingStatus} = 'failed'`),
		index("asset_processing_failure_idx")
			.on(table.processingFailureId)
			.where(sql`${table.processingFailureId} is not null`),
		index("asset_metadata_failure_idx")
			.on(table.metadataFailureId)
			.where(sql`${table.metadataFailureId} is not null`),
		index("asset_metadata_attention_owner_idx")
			.on(sql`coalesce(${table.metadataActorId}, ${table.userId})`)
			.where(
				sql`${table.metadataStatus} = 'failed' or ${table.metadataSuggestion} is not null`,
			),
	],
);
