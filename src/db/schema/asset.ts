import type { InferSelectModel } from "drizzle-orm";
import {
	integer,
	json,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export interface AssetMetadataType {
	showReference: boolean;
	relevance: "high" | "medium" | "low";
	citation?: string;
	externalUrl?: string;
	pageRange?: string;
	author?: string;
	chapterTitle?: string;
	mergePages?: boolean;
}

export const assetTable = pgTable("asset", {
	id: uuid("id").primaryKey().defaultRandom(),
	bucket: text("bucket").notNull(),
	prefix: text("prefix").notNull(),
	title: text("title").notNull(),
	metadata: json("metadata")
		.notNull()
		.$type<AssetMetadataType>()
		.default({ showReference: true, relevance: "medium" }),
	size: integer("size").notNull(),
	// TODO: Should probably be an enum
	fileType: text("file_type").notNull(),
	// TODO: Check what should be done if user deletes account
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id),
	updatedAt: timestamp("updated_at").defaultNow(),
	createdAt: timestamp("created_at").defaultNow(),
});

export type Asset = InferSelectModel<typeof assetTable>;
