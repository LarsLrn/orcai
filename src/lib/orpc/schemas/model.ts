import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { modelTable } from "@/db/schema/model";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const modelSelectSchema = createSelectSchema(modelTable);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Model = z.infer<typeof modelSelectSchema>;
