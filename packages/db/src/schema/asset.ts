import type { AssetId, UserId } from "@orcai/core";
import {
	ASSET_FILE_TYPES,
	ASSET_ORIGINS,
	type AssetMetadataType,
	type BucketName,
	PIPELINE_FAILURES,
	PIPELINE_STATUSES,
} from "@orcai/schema";
import {
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

export const asset = pgTable("asset", {
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
	/** Counts processing requests; a delivery for an earlier one does nothing. */
	processingGeneration: integer("processing_generation").notNull().default(0),
	fileType: assetFileTypeEnum("file_type").notNull(),
	origin: assetOriginEnum("origin").notNull().default("library"),
	// TODO: Check what should be done if user deletes account
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	updatedAt: timestamp("updated_at").defaultNow(),
	createdAt: timestamp("created_at").defaultNow(),
});
