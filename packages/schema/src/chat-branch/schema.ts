import type { ChatBranchId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the chat-branch resource migration.
export const chatBranchIdSchema = createUuidIdSchema<ChatBranchId>();
