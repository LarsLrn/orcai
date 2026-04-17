import type { UserId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the user resource migration.
export const userIdSchema = createUuidIdSchema<UserId>();
