import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const providerSelectSchema = createSelectSchema(dbSchema.provider);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Provider = z.infer<typeof providerSelectSchema>;
