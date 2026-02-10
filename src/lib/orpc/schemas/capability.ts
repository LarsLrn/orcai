import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

const capabilities = z.enum([
	"embedding",
	"image-generation",
	"reasoning",
	"text-generation",
	"tool-calling",
]);

export const capabilitySelectSchema = createSelectSchema(dbSchema.capability, {
	capability: capabilities,
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Capability = z.infer<typeof capabilitySelectSchema>;
