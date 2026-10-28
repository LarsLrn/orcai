import type {
	BotId,
	ChatId,
	ChatMessageId,
	ModelId,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import type { Features } from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	json,
	pgEnum,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { bot } from "./bot";
import { chatMessage } from "./chat-message";
import { chatTitleSearchVector } from "./chat-search";
import { organization } from "./organization";

export const chatKindEnum = pgEnum("chat_kind", [
	"chat",
	"assistant",
]);

export const chat = pgTable(
	"chat",
	{
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
		kind: chatKindEnum("kind").notNull().default("chat"),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		/** Set when the bot is deleted, which leaves the chat read-only. */
		botDeletedAt: timestamp("bot_deleted_at"),
		/** Chats are never shared, so the pin is the owner's. */
		pinnedAt: timestamp("pinned_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		check(
			"chat_assistant_shape",
			sql`${table.kind} <> 'assistant' OR (${table.botId} IS NULL AND ${table.parentChatId} IS NULL)`,
		),
		index("chat_organization_user_updated_idx").on(
			table.organizationId,
			table.userId,
			table.updatedAt,
		),
		index("chat_title_search_idx").using(
			"gin",
			chatTitleSearchVector(table.title),
		),
	],
);

export interface ChatConfig {
	modelId?: ModelId;
	providerId?: ProviderId;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	features?: Features;
}
