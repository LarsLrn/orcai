import type { ChatMessageId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the chat-message resource migration.
export const chatMessageIdSchema = createUuidIdSchema<ChatMessageId>();
