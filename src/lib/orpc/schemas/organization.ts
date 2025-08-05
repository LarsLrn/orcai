import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { organization } from "@/db/schema/organization";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationSelectSchema = createSelectSchema(organization);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationInsertSchema = createInsertSchema(organization).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationUpdateSchema = createUpdateSchema(organization, {
	id: z.uuidv4(),
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationDeleteSchema = z.object({
	refs: z.array(organizationUpdateSchema.pick({ id: true })),
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
