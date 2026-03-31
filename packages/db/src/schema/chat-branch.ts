import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { chat } from "./chat";
import { chatMessage } from "./chat-message";

export const chatBranch = pgTable("chat_branch", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	chatId: uuid("chat_id")
		.notNull()
		.references(() => chat.id, {
			onDelete: "cascade",
		}),
	// The Head Pointer: This determines the content of the branch
	leafMessageId: uuid("leaf_message_id").references(() => chatMessage.id),
	name: varchar("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
