import { z } from "zod/v4";
import { blockSchema } from "../block";
import { createDataResponseSchema, statusResponseSchema } from "../shared";
import { chatBlockSchema } from "./schema";

export const listChatBlocksResponseSchema = z.object({
	data: z.array(blockSchema),
});

export const attachChatBlockResponseSchema =
	createDataResponseSchema(chatBlockSchema);

export const detachChatBlockResponseSchema = statusResponseSchema;
