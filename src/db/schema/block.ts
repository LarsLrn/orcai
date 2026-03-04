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
import { asset } from "./asset";
import { user } from "./auth";
import { chat } from "./chat";

export const block = pgTable("block", {
	id: uuid("id").primaryKey().defaultRandom(),
	type: text("type").notNull(),
	name: text("name").notNull(),
	config: json("config").notNull(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	forkedFromId: uuid("forked_from_id").references((): AnyPgColumn => block.id, {
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
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		chatId: uuid("chat_id")
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
		.notNull()
		.references(() => block.id, {
			onDelete: "cascade",
		}),
	assetId: uuid("asset_id")
		.notNull()
		.references(() => asset.id, {
			onDelete: "cascade",
		}),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
