import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { providerTable } from "@/db/schema/model";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const providerSelectSchema = createSelectSchema(providerTable);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Provider = z.infer<typeof providerSelectSchema>;
