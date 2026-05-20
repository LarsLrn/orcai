import type { ChatBranchId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const chatBranchIdSchema = createUuidIdSchema<ChatBranchId>();
