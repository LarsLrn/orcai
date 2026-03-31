import {
	type AnyPgColumn,
	json,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";
import { chatBranch } from "./chat-branch";

export const chat = pgTable("chat", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	title: varchar("title"),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	botId: uuid("bot_id").references(() => bot.id, {
		onDelete: "set null",
	}),
	activeBranchId: uuid("active_branch_id").references(
		(): AnyPgColumn => chatBranch.id,
		{
			onDelete: "set null",
		},
	),
	config: json("config").$type<ChatConfig>().default({}),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface ChatConfig {
	modelId?: string;
	providerId?: string;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}
