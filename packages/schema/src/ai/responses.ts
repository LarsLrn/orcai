import { keptUploadsSchema } from "../chat-message/parts/metadata";
import { createDataResponseSchema } from "../shared/responses";

export { aiChatStreamSchema as aiChatResponseSchema } from "./schema";

export const keepUploadsResponseSchema =
	createDataResponseSchema(keptUploadsSchema);
