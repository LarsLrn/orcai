import { defineRelations } from "drizzle-orm";
import { dbSchema } from ".";

export const relations = defineRelations(dbSchema, (r) => ({
	chatBranch: {
		chat: r.one.chat({
			from: r.chatBranch.chatId,
			to: r.chat.id,
		}),
		leafMessage: r.one.chatMessage({
			from: r.chatBranch.leafMessageId,
			to: r.chatMessage.id,
		}),
	},
	chatMessage: {
		chat: r.one.chat({
			from: r.chatMessage.chatId,
			to: r.chat.id,
		}),

		parent: r.one.chatMessage({
			from: r.chatMessage.parentMessageId,
			to: r.chatMessage.id,
			alias: "child_parent",
		}),

		children: r.many.chatMessage({
			alias: "child_parent",
		}),
	},
	chat: {
		user: r.one.user({
			from: r.chat.userId,
			to: r.user.id,
		}),

		activeBranch: r.one.chatBranch({
			from: r.chat.activeBranchId,
			to: r.chatBranch.id,
		}),

		messages: r.many.chatMessage(),
		branches: r.many.chatBranch(),
	},
}));
