import type { AssetId, UserId } from "@orcai/core";
import {
	ASSET_FILE_TYPES,
	type AssetMetadataType,
	type BucketName,
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

export const asset = pgTable("asset", {
	id: uuid("id").$type<AssetId>().primaryKey().defaultRandom(),
	bucket: text("bucket").$type<BucketName>().notNull(),
	prefix: text("prefix").notNull(),
	title: text("title").notNull(),
	metadata: json("metadata").notNull().$type<AssetMetadataType>().default({
		showReference: true,
		relevance: "medium",
	}),
	size: integer("size").notNull(),
	processingStatus: text("processing_status")
		.notNull()
		.default("pending")
		.$type<"pending" | "active" | "completed" | "failed">(),
	fileType: assetFileTypeEnum("file_type").notNull(),
	// TODO: Check what should be done if user deletes account
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	updatedAt: timestamp("updated_at").defaultNow(),
	createdAt: timestamp("created_at").defaultNow(),
});
