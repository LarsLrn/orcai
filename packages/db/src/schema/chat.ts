import type {
	BotId,
	ChatBranchId,
	ChatId,
	ModelId,
	ProviderId,
	UserId,
} from "@orcai/core";
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
	id: uuid("id").$type<ChatId>().primaryKey().notNull().defaultRandom(),
	title: varchar("title"),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id, {
			onDelete: "cascade",
		}),
	botId: uuid("bot_id")
		.$type<BotId>()
		.references(() => bot.id, {
			onDelete: "set null",
		}),
	activeBranchId: uuid("active_branch_id")
		.$type<ChatBranchId>()
		.references((): AnyPgColumn => chatBranch.id, {
			onDelete: "set null",
		}),
	config: json("config").$type<ChatConfig>().default({}),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export interface ChatConfig {
	modelId?: ModelId;
	providerId?: ProviderId;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}
