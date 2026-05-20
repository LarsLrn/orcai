import type { ModelId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const modelIdSchema = createUuidIdSchema<ModelId>();
