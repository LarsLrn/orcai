import type { ChatId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the chat resource migration.
export const chatIdSchema = createUuidIdSchema<ChatId>();
