import type { ProviderId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the provider resource migration.
export const providerIdSchema = createUuidIdSchema<ProviderId>();
