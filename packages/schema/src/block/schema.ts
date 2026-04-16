import type { BlockId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the block resource migration.
export const blockIdSchema = createUuidIdSchema<BlockId>();
