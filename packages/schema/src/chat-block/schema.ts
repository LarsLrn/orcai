import { z } from "zod/v4";
import { blockIdSchema, chatIdSchema } from "../shared/ids";

export const chatBlockSchema = z.object({
	blockId: blockIdSchema,
	chatId: chatIdSchema,
	createdAt: z.coerce.date(),
});
