import type { BotId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the bot resource migration.
export const botIdSchema = createUuidIdSchema<BotId>();
