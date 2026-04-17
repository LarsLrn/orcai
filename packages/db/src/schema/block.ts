import type { AssetId, BlockId, ChatId, UserId } from "@orcai/core";
import type { PublicationStatus } from "@orcai/schema";
import {
	type AnyPgColumn,
	integer,
	json,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { asset } from "./asset";
import { user } from "./auth";
import { chat } from "./chat";

export const block = pgTable("block", {
	id: uuid("id").$type<BlockId>().primaryKey().defaultRandom(),
	type: text("type").notNull(),
	name: text("name").notNull(),
	description: varchar("description", {
		length: 500,
	}),
	contentJson: json("content_json"),
	contentHtml: text("content_html"),
	config: json("config").notNull(),
	status: text("status").$type<PublicationStatus>().notNull().default("ready"),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	forkedFromId: uuid("forked_from_id")
		.$type<BlockId>()
		.references((): AnyPgColumn => block.id, {
			onDelete: "set null",
		}),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatBlock = pgTable(
	"chat_block",
	{
		blockId: uuid("block_id")
			.$type<BlockId>()
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		chatId: uuid("chat_id")
			.$type<ChatId>()
			.notNull()
			.references(() => chat.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.blockId,
				table.chatId,
			],
		}),
	],
);

export const blockAsset = pgTable("block_asset", {
	blockId: uuid("block_id")
		.$type<BlockId>()
		.notNull()
		.references(() => block.id, {
			onDelete: "cascade",
		}),
	assetId: uuid("asset_id")
		.$type<AssetId>()
		.notNull()
		.references(() => asset.id, {
			onDelete: "cascade",
		}),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
