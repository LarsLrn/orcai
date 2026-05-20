import type { ChatId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const chatIdSchema = createUuidIdSchema<ChatId>();
