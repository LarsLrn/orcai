import type { ChatMessageId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const chatMessageIdSchema = createUuidIdSchema<ChatMessageId>();
