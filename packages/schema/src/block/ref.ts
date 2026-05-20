import type { BlockId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const blockIdSchema = createUuidIdSchema<BlockId>();
