import { z } from "zod/v4";
import { chatMessageAttachmentSchema } from "../chat-message/parts/attachment";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import {
	chatBranchLinkSchema,
	chatLinkSchema,
	chatListRowSchema,
	chatSchema,
} from "./schema";

export const listChatsResponseSchema =
	createListResponseSchema(chatListRowSchema);

export const findChatResponseSchema = createDataResponseSchema(
	chatSchema.extend({
		parentChat: chatLinkSchema.nullable(),
		branches: z.array(chatBranchLinkSchema),
	}),
);

export const createChatResponseSchema = createDataResponseSchema(chatSchema);

export const updateChatResponseSchema = createDataResponseSchema(chatSchema);

export const deleteChatResponseSchema = createDeleteResponseSchema();

export const branchChatResponseSchema = createDataResponseSchema(
	chatSchema,
).extend({
	draft: z
		.object({
			text: z.string(),
			attachments: z.array(chatMessageAttachmentSchema),
		})
		.nullable(),
});
