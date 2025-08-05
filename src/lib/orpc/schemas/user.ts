import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { user } from "@/db/schema/auth";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const userSelectSchema = createSelectSchema(user);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type User = z.infer<typeof userSelectSchema>;
