import type { BotId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const botIdSchema = createUuidIdSchema<BotId>();
