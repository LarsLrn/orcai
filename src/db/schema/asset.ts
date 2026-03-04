import {
	integer,
	json,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { AssetMetadataType } from "@/lib/orpc/schemas/fragments/asset-metadata";
import { user } from "./auth";

export const asset = pgTable("asset", {
	id: uuid("id").primaryKey().defaultRandom(),
	bucket: text("bucket").notNull(),
	prefix: text("prefix").notNull(),
	title: text("title").notNull(),
	metadata: json("metadata").notNull().$type<AssetMetadataType>().default({
		showReference: true,
		relevance: "medium",
	}),
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
