import { defineRelations } from "drizzle-orm";
import { dbSchema } from ".";

export const relations = defineRelations(dbSchema, (r) => ({
	chatMessage: {
		chat: r.one.chat({
			from: r.chatMessage.chatId,
			to: r.chat.id,
		}),
	},
	chat: {
		user: r.one.user({
			from: r.chat.userId,
			to: r.user.id,
		}),
		parentChat: r.one.chat({
			from: r.chat.parentChatId,
			to: r.chat.id,
			alias: "chat_parent",
		}),
		branches: r.many.chat({
			alias: "chat_parent",
		}),
		messages: r.many.chatMessage(),
	},
}));
