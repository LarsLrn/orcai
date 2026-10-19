import type {
	BotId,
	ChatId,
	ChatMessageId,
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
import { chatMessage } from "./chat-message";

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
	parentChatId: uuid("parent_chat_id")
		.$type<ChatId>()
		.references((): AnyPgColumn => chat.id, {
			onDelete: "set null",
		}),
	branchedFromMessageId: uuid("branched_from_message_id")
		.$type<ChatMessageId>()
		.references((): AnyPgColumn => chatMessage.id, {
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
