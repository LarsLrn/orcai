import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { botTable } from "@/db/schema/bot";
import { baseBlockSelectSchema } from "./block";

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
		blockIds: z
			.array(baseBlockSelectSchema.shape.id)
			.min(1, "At least one active block is required"),
		contentJson: z
			.json()
			.refine(
				(val) =>
					val !== null &&
					typeof val === "object" &&
					!Array.isArray(val) &&
					Object.keys(val as object).length > 0,
				{ message: "Content is required" },
			),
	});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const botUpdateSchema = createUpdateSchema(botTable, {
	id: z.uuidv4(),
}).extend({
	blockIds: z
		.array(baseBlockSelectSchema.shape.id)
		.min(1, "At least one active block is required"),
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
