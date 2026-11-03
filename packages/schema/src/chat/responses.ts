import { z } from "zod/v4";
import { chatMessageAttachmentSchema } from "../chat-message/parts/attachment";
import {
	modelIdSchema,
	organizationIdSchema,
	providerIdSchema,
} from "../shared/ids";
import {
	createDataResponseSchema,
	createDeleteResponseSchema,
	createListResponseSchema,
} from "../shared/responses";
import {
	chatBranchLinkSchema,
	chatHistoryRowSchema,
	chatLinkSchema,
	chatListRowSchema,
	chatReadOnlyReasonSchema,
	chatSchema,
	effectiveModelSchema,
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
		effectiveModel: effectiveModelSchema,
	}),
);

export const createChatResponseSchema = createDataResponseSchema(chatSchema);

/** Null when the organisation has no model a chat can run on. */
export const defaultChatModelResponseSchema = createDataResponseSchema(
	z
		.object({
			modelId: modelIdSchema,
			providerId: providerIdSchema,
		})
		.nullable(),
);

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
