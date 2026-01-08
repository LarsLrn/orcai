import { relations } from "drizzle-orm";
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
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	chatId: uuid("chat_id")
		.notNull()
		.references(() => chat.id, { onDelete: "cascade" }),
	role: varchar("role").notNull(),
	parts: json("parts").notNull(),
	attachments: json("attachments").notNull(),
	metadata: json("metadata").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	// The DAG Pointer - enables branching conversations
	parentMessageId: uuid("parent_message_id").references(
		(): AnyPgColumn => chatMessage.id,
		{ onDelete: "set null" },
	),
	// Optimization: Distance from root. 0 = System/Root, 1 = First User Msg, etc.
	depth: integer("depth").notNull().default(0),
});

export const messagesRelations = relations(chatMessage, ({ one, many }) => ({
	chat: one(chat, {
		fields: [chatMessage.chatId],
		references: [chat.id],
	}),
	parent: one(chatMessage, {
		fields: [chatMessage.parentMessageId],
		references: [chatMessage.id],
		relationName: "child_parent",
	}),
	children: many(chatMessage, { relationName: "child_parent" }),
}));
