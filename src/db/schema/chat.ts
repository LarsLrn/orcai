import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { botTable } from "./bot";
import { chatBranch } from "./chat-branch";
import { chatMessage } from "./chat-message";

export const chat = pgTable("chat", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	title: varchar("title"),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	botId: uuid("bot_id").references(() => botTable.id, { onDelete: "set null" }),
	activeBranchId: uuid("active_branch_id").references(
		(): AnyPgColumn => chatBranch.id,
		{ onDelete: "set null" },
	),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatsRelations = relations(chat, ({ one, many }) => ({
	user: one(user, {
		fields: [chat.userId],
		references: [user.id],
	}),
	activeBranch: one(chatBranch, {
		fields: [chat.activeBranchId],
		references: [chatBranch.id],
	}),
	messages: many(chatMessage),
	branches: many(chatBranch),
}));
