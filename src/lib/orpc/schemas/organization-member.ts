import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { member } from "@/db/schema/organization";

/**
 * ----------------
 * Select Schema
 * ----------------
 */

export const organizationMemberSelectSchema = createSelectSchema(member);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationMemberInsertSchema = createInsertSchema(member).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationMemberUpdateSchema = createUpdateSchema(member, {
	organizationId: z.uuidv4(),
	userId: z.uuidv4(),
});

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationMemberDeleteSchema = z.object({
	organizationId: organizationMemberSelectSchema.shape.organizationId,
	refs: z.array(organizationMemberUpdateSchema.pick({ userId: true })),
});

/**
 * ----------------
 * Type Definitions
 * ----------------
 */

export type OrganizationMember = z.infer<typeof organizationMemberSelectSchema>;
export type OrganizationMemberInsert = z.infer<
	typeof organizationMemberInsertSchema
>;
export type OrganizationMemberUpdate = z.infer<
	typeof organizationMemberUpdateSchema
>;
export type OrganizationMemberDelete = z.infer<
	typeof organizationMemberDeleteSchema
>;
