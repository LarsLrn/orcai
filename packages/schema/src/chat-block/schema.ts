import { z } from "zod/v4";
import { blockIdSchema } from "../block/ref";
import { chatIdSchema } from "../chat/ref";

export const chatBlockSchema = z.object({
	blockId: blockIdSchema,
	chatId: chatIdSchema,
	createdAt: z.coerce.date(),
});

export type ChatBlock = z.infer<typeof chatBlockSchema>;
