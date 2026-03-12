import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const botSelectSchema = createSelectSchema(dbSchema.bot);
export const botStatusSchema = botSelectSchema.shape.status;

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const botDeleteSchema = z.object({
	refs: z.array(
		botSelectSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Bot = z.infer<typeof botSelectSchema>;
