import type { InferSelectModel } from "drizzle-orm";
import {
	type AnyPgColumn,
	integer,
	json,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { z } from "zod/v4";
import type {
	databaseBlockSchema,
	templateBlockSchema,
} from "@/lib/orpc/contracts/block";
import { assetTable } from "./asset";
import { user } from "./auth";
import { chat } from "./chat";

export type BlockConfigType =
	| z.infer<typeof templateBlockSchema>
	| z.infer<typeof databaseBlockSchema>;

export type BlockTypes = "template" | "database";

export const blockTable = pgTable("block", {
	id: uuid("id").primaryKey().defaultRandom(),
	type: text("type").$type<BlockTypes>().notNull(),
	name: text("name").notNull(),
	config: json("config").notNull().$type<BlockConfigType>(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	forkedFromId: uuid("forked_from_id").references(
		(): AnyPgColumn => blockTable.id,
		{
			onDelete: "set null",
		},
	),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// Type-safe block variants
export type TemplateBlock = InferSelectModel<typeof blockTable> & {
	config: Extract<BlockConfigType, { type: "template" }>;
};

export type DatabaseBlock = InferSelectModel<typeof blockTable> & {
	config: Extract<BlockConfigType, { type: "database" }>;
};

export const chatBlockTable = pgTable(
	"chat_block",
	{
		blockId: uuid("block_id")
			.notNull()
			.references(() => blockTable.id, { onDelete: "cascade" }),
		chatId: uuid("chat_id")
			.notNull()
			.references(() => chat.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.blockId, table.chatId] })],
);

export const blockAssetTable = pgTable("block_asset", {
	blockId: uuid("block_id")
		.notNull()
		.references(() => blockTable.id, { onDelete: "cascade" }),
	assetId: uuid("asset_id")
		.notNull()
		.references(() => assetTable.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BlockAsset = InferSelectModel<typeof blockAssetTable>;
