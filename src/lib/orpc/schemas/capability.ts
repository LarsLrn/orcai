import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { capabilityTable } from "@/db/schema/model";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const capabilitySelectSchema = createSelectSchema(capabilityTable);

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Capability = z.infer<typeof capabilitySelectSchema>;
