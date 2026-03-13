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
import type { PublicationStatus } from "@/lib/orpc/schemas/fragments/publication-status";
import { user } from "./auth";
import { block } from "./block";

export const bot = pgTable("bot", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: varchar("description", {
		length: 500,
	}).notNull(),
	contentJson: json("content_json").notNull().default({}),
	contentHtml: text("content_html").notNull(),
	status: text("status").$type<PublicationStatus>().notNull().default("ready"),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	forkedFromId: uuid("forked_from_id").references((): AnyPgColumn => bot.id, {
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
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		botId: uuid("bot_id")
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
