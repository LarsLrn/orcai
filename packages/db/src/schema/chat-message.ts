import type { ChatId, ChatMessageId } from "@orcai/core";
import type {
	ChatMessageAttachments,
	ChatMessageMetadata,
	ChatMessageParts,
} from "@orcai/schema";
import {
	type AnyPgColumn,
	integer,
	json,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { chat } from "./chat";

export const chatMessage = pgTable("chat_message", {
	id: uuid("id").$type<ChatMessageId>().primaryKey().notNull().defaultRandom(),
	chatId: uuid("chat_id")
		.$type<ChatId>()
		.notNull()
		.references(() => chat.id, {
			onDelete: "cascade",
		}),
	role: varchar("role").notNull(),
	parts: json("parts").$type<ChatMessageParts>().notNull(),
	attachments: json("attachments").$type<ChatMessageAttachments>().notNull(),
	metadata: json("metadata").$type<ChatMessageMetadata>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	// The DAG Pointer - enables branching conversations
	parentMessageId: uuid("parent_message_id")
		.$type<ChatMessageId>()
		.references((): AnyPgColumn => chatMessage.id, {
			onDelete: "set null",
		}),
	// Optimization: Distance from root. 0 = System/Root, 1 = First User Msg, etc.
	depth: integer("depth").notNull().default(0),
});
