import type { ProviderId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const providerIdSchema = createUuidIdSchema<ProviderId>();
