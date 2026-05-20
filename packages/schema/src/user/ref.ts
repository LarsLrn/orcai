import type { UserId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const userIdSchema = createUuidIdSchema<UserId>();
