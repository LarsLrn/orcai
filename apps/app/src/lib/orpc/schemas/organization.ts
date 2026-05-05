import { dbSchema } from "@orcai/db/schema";
import { organizationIdSchema } from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from "zod/v4";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationSelectSchema = createSelectSchema(
	dbSchema.organization,
	{
		id: organizationIdSchema,
	},
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationInsertSchema = createInsertSchema(
	dbSchema.organization,
	{
		id: organizationIdSchema.optional(),
	},
).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationUpdateSchema = createUpdateSchema(
	dbSchema.organization,
	{
		id: organizationIdSchema,
	},
);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationDeleteSchema = z.object({
	refs: z.array(
		organizationUpdateSchema.pick({
			id: true,
		}),
	),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type Organization = z.infer<typeof organizationSelectSchema>;
export type OrganizationInsert = z.infer<typeof organizationInsertSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationDelete = z.infer<typeof organizationDeleteSchema>;
