import { dbSchema } from "@orcai/db/schema";
import {
	botIdSchema,
	publicationStatusSchema,
	userIdSchema,
} from "@orcai/schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const botSelectSchema = createSelectSchema(dbSchema.bot, {
	id: botIdSchema,
	status: publicationStatusSchema,
	userId: userIdSchema,
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
