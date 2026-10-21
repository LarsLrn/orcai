import type { ChatId, ChatMessageId, UserId } from "@orcai/core";
import type {
	ChatMessageAttachment,
	ChatMessageMetadata,
	ChatMessageParts,
} from "@orcai/schema";
import {
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
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

export const chatMessageRatingEnum = pgEnum("chat_message_rating_value", [
	"very_much",
	"a_bit",
	"not_really",
	"not_at_all",
]);

export const chatMessageRating = pgTable(
	"chat_message_rating",
	{
		messageId: uuid("message_id")
			.$type<ChatMessageId>()
			.notNull()
			.references(() => chatMessage.id, {
				onDelete: "cascade",
			}),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		rating: chatMessageRatingEnum("rating").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.messageId,
				table.userId,
			],
		}),
	],
);
