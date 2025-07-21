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
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { blockTable } from "./block";

export const botTable = pgTable("bot", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: varchar("description", { length: 500 }).notNull(),
	contentJson: json("content_json").notNull().default({}),
	contentHtml: text("content_html").notNull(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	forkedFromId: uuid("forked_from_id").references(
		(): AnyPgColumn => botTable.id,
		{
			onDelete: "set null",
		},
	),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export type Bot = InferSelectModel<typeof botTable>;

export const botBlockTable = pgTable(
	"bot_block",
	{
		blockId: uuid("block_id")
			.notNull()
			.references(() => blockTable.id, { onDelete: "cascade" }),
		botId: uuid("bot_id")
			.notNull()
			.references(() => botTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.blockId, table.botId] })],
);
