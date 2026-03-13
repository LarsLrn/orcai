import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dbSchema } from "@/db/schema";
import { publicationStatusSchema } from "./fragments/publication-status";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const botSelectSchema = createSelectSchema(dbSchema.bot, {
	status: publicationStatusSchema,
});

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
