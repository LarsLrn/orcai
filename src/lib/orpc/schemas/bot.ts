import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { botTable } from "@/db/schema/bot";
import { baseBlockSelectSchema, blockSelectSchema } from "./block";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const botSelectSchema = createSelectSchema(botTable);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const botInsertSchema = createInsertSchema(botTable)
	.omit({
		userId: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		name: z.string().min(1, "Bot name is required"),
		description: z.string().min(1, "Bot description is required"),
		blocks: z
			.array(blockSelectSchema)
			.min(1, "At least one active block is required"),
	});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const botUpdateSchema = createUpdateSchema(botTable, {
	id: z.uuidv4(),
}).extend({
	blocks: z.array(
		baseBlockSelectSchema.pick({ id: true, name: true, type: true }),
	),
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const botDeleteSchema = z.object({
	refs: z.array(botUpdateSchema.pick({ id: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Bot = z.infer<typeof botSelectSchema>;
export type BotInsert = z.infer<typeof botInsertSchema>;
export type BotUpdate = z.infer<typeof botUpdateSchema>;
export type BotDelete = z.infer<typeof botDeleteSchema>;
