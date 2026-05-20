import type { ChatId } from "@orcai/core";
import { z } from "zod/v4";
import { botIdSchema } from "../bot";
import { chatBranchIdSchema } from "../chat-branch";
import { chatConfigSchema } from "../fragments";
import { createUuidIdSchema } from "../shared";
import { userIdSchema } from "../user";

export const chatIdSchema = createUuidIdSchema<ChatId>();

export const chatFieldsSchema = z.object({
	title: z.string().nullable(),
	config: chatConfigSchema.nullable(),
	botId: botIdSchema.nullable(),
	activeBranchId: chatBranchIdSchema.nullable(),
});

export const chatMutableFieldsSchema = chatFieldsSchema.partial();

export const chatSchema = chatFieldsSchema.extend({
	id: chatIdSchema,
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export type Chat = z.infer<typeof chatSchema>;
