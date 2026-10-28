import { z } from "zod/v4";
import { chatMessageAttachmentSchema } from "../chat-message/parts/attachment";
import { organizationIdSchema } from "../organization/ref";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared";
import {
	chatBranchLinkSchema,
	chatHistoryRowSchema,
	chatLinkSchema,
	chatListRowSchema,
	chatReadOnlyReasonSchema,
	chatSchema,
} from "./schema";

export const listChatsResponseSchema =
	createListResponseSchema(chatListRowSchema);

export const listChatHistoryResponseSchema =
	createListResponseSchema(chatHistoryRowSchema);

export const findChatResponseSchema = createDataResponseSchema(
	chatSchema.extend({
		parentChat: chatLinkSchema.nullable(),
		branches: z.array(chatBranchLinkSchema),
		organization: z.object({
			id: organizationIdSchema,
			name: z.string(),
		}),
		/** Null when the requester can continue the chat. */
		readOnly: chatReadOnlyReasonSchema.nullable(),
	}),
);

export const createChatResponseSchema = createDataResponseSchema(chatSchema);

export const updateChatResponseSchema = createDataResponseSchema(chatSchema);

export const pinChatResponseSchema = createDataResponseSchema(chatSchema);

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
