import type { ChatId, ChatMessageId } from "@orcai/core";
import type { dbSchema } from "@orcai/db";
import type { ChatMessageMetadata } from "@orcai/schema";
import type { UIMessage } from "ai";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as AppErrors from "@/lib/effect/utils/errors";

export type StoredChat = typeof dbSchema.chat.$inferSelect;
export type StoredMessage = typeof dbSchema.chatMessage.$inferSelect;

export type NewMessage = Pick<
	StoredMessage,
	"id" | "role" | "parts" | "attachments" | "metadata"
>;

export type ReplyContent = {
	parts: UIMessage["parts"];
	metadata: ChatMessageMetadata;
};

/** A reserved reply that is still empty, e.g. one whose turn never ended. */
export const isEmptyReply = (message: { parts: unknown[] }) =>
	message.parts.length === 0;

/** Where a chat's rows live between turns. */
export class ReplyStore extends Context.Service<
	ReplyStore,
	{
		/** The chat and its messages in order, or nothing when it does not exist. */
		readonly load: (chatId: ChatId) => Effect.Effect<
			| {
					chat: StoredChat;
					messages: StoredMessage[];
			  }
			| undefined,
			AppErrors.InternalError
		>;
		/**
		 * Stores the closed last reply, then appends the question and an empty
		 * reply after the chat's last message, all or nothing.
		 */
		readonly reserve: (input: {
			chatId: ChatId;
			closedReply:
				| {
						id: ChatMessageId;
						parts: UIMessage["parts"];
				  }
				| undefined;
			question: NewMessage;
			replyId: ChatMessageId;
		}) => Effect.Effect<
			void,
			AppErrors.BadRequestError | AppErrors.InternalError
		>;
		/**
		 * Holds the chat while `update` rewrites the reply, which it receives only
		 * while the reply is the chat's last message; no message lands meanwhile.
		 */
		readonly claim: <E>(input: {
			chatId: ChatId;
			replyId: ChatMessageId;
			update: (
				reply: StoredMessage | undefined,
			) => Effect.Effect<ReplyContent, E>;
		}) => Effect.Effect<ReplyContent, E | AppErrors.InternalError>;
		/** Stores what the reply holds; a reply without parts is removed. */
		readonly settle: (input: {
			chatId: ChatId;
			replyId: ChatMessageId;
			reply: ReplyContent;
		}) => Effect.Effect<void, AppErrors.InternalError>;
	}
>()("ReplyStore") {}
