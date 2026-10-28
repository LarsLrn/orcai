import { z } from "zod/v4";
import { botIdSchema } from "../bot/ref";
import { chatMessageIdSchema } from "../chat-message/ref";
import { organizationIdSchema } from "../organization/ref";
import { searchFilterSchema } from "../shared/filters";
import { userIdSchema } from "../user/ref";
import { chatConfigSchema } from "./parts/config";
import { chatIdSchema } from "./ref";

export const chatKindSchema = z.enum([
	"chat",
	"assistant",
]);

/** Why a chat can be read but not continued: its bot is gone or not available, its organisation was left, or another one is active. */
export const chatReadOnlyReasonSchema = z.enum([
	"bot-deleted",
	"bot-unavailable",
	"not-member",
	"other-organization",
]);

export const chatFieldsSchema = z.object({
	title: z.string().nullable(),
	config: chatConfigSchema.nullable(),
	botId: botIdSchema.nullable(),
});

export const chatMutableFieldsSchema = chatFieldsSchema.partial();

export const chatSchema = chatFieldsSchema.extend({
	id: chatIdSchema,
	parentChatId: chatIdSchema.nullable(),
	branchedFromMessageId: chatMessageIdSchema.nullable(),
	kind: chatKindSchema,
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	botDeletedAt: z.coerce.date().nullable(),
	pinnedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const chatFiltersSchema = z.object({
	botId: botIdSchema.optional(),
	...searchFilterSchema.shape,
});

/** Text around a search hit, the matched terms highlighted. */
export const chatSearchSnippetSchema = z.array(
	z.object({
		text: z.string(),
		highlighted: z.boolean(),
	}),
);

export const chatListRowSchema = chatSchema.extend({
	botName: z.string().nullable(),
	/** Under a search, the best matching message; null when only the title matched. */
	match: z
		.object({
			messageId: chatMessageIdSchema,
			snippet: chatSearchSnippetSchema,
		})
		.nullable(),
});

/** A chat of an organisation its owner is no longer a member of. */
export const chatHistoryRowSchema = chatSchema.extend({
	organizationName: z.string(),
	botName: z.string().nullable(),
});

export const chatLinkSchema = z.object({
	id: chatIdSchema,
	title: z.string().nullable(),
});

export const chatBranchLinkSchema = chatLinkSchema.extend({
	branchedFromMessageId: chatMessageIdSchema,
	createdAt: z.coerce.date().nullable(),
});

export type ChatKind = z.infer<typeof chatKindSchema>;
export type ChatReadOnlyReason = z.infer<typeof chatReadOnlyReasonSchema>;
export type ChatHistoryRow = z.infer<typeof chatHistoryRowSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type ChatLink = z.infer<typeof chatLinkSchema>;
export type ChatBranchLink = z.infer<typeof chatBranchLinkSchema>;
export type ChatListRow = z.infer<typeof chatListRowSchema>;
export type ChatSearchSnippet = z.infer<typeof chatSearchSnippetSchema>;
