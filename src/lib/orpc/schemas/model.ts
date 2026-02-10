import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const modelSelectSchema = createSelectSchema(dbSchema.model);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Model = z.infer<typeof modelSelectSchema>;
