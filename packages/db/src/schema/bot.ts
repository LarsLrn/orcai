import type { BlockId, BotId, UserId } from "@orcai/core";
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
import { user } from "./auth";
import { block } from "./block";

export const bot = pgTable("bot", {
	id: uuid("id").$type<BotId>().primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: varchar("description", {
		length: 500,
	}).notNull(),
	contentJson: json("content_json").notNull().default({}),
	contentHtml: text("content_html").notNull(),
	status: text("status").$type<PublicationStatus>().notNull().default("ready"),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	forkedFromId: uuid("forked_from_id")
		.$type<BotId>()
		.references((): AnyPgColumn => bot.id, {
			onDelete: "set null",
		}),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const botBlock = pgTable(
	"bot_block",
	{
		blockId: uuid("block_id")
			.$type<BlockId>()
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		botId: uuid("bot_id")
			.$type<BotId>()
			.notNull()
			.references(() => bot.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.blockId,
				table.botId,
			],
		}),
	],
);
