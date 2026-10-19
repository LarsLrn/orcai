import type { ChatId, ChatMessageId } from "@orcai/core";
import type {
	ChatMessageAttachment,
	ChatMessageMetadata,
	ChatMessageParts,
} from "@orcai/schema";
import {
	integer,
	json,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { chat } from "./chat";

export const chatMessage = pgTable(
	"chat_message",
	{
		id: uuid("id")
			.$type<ChatMessageId>()
			.primaryKey()
			.notNull()
			.defaultRandom(),
		chatId: uuid("chat_id")
			.$type<ChatId>()
			.notNull()
			.references(() => chat.id, {
				onDelete: "cascade",
			}),
		role: varchar("role").notNull(),
		parts: json("parts").$type<ChatMessageParts>().notNull(),
		attachments: json("attachments").$type<ChatMessageAttachment[]>().notNull(),
		metadata: json("metadata").$type<ChatMessageMetadata>().notNull(),
		position: integer("position").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("chat_message_chat_position_unique").on(
			table.chatId,
			table.position,
		),
	],
);
