import { z } from "zod/v4";
import { paginationInputSchema } from "../shared/pagination";
import { zedTokenSchema } from "../shared/zed-token";

export const listAssistantConversationsInputSchema =
	paginationInputSchema.extend({
		...zedTokenSchema.shape,
	});

export const createAssistantConversationInputSchema = z.object({});
