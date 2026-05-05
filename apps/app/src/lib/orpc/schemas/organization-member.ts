import { dbSchema } from "@orcai/db/schema";
import {
	memberIdSchema,
	organizationIdSchema,
	userIdSchema,
} from "@orcai/schema";
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

export const organizationMemberSelectSchema = createSelectSchema(
	dbSchema.member,
	{
		id: memberIdSchema,
		organizationId: organizationIdSchema,
		userId: userIdSchema,
	},
);

/**
 * ----------------
 * Insert Schema
 * ----------------
 */

export const organizationMemberInsertSchema = createInsertSchema(
	dbSchema.member,
	{
		id: memberIdSchema.optional(),
		organizationId: organizationIdSchema,
		userId: userIdSchema,
	},
).omit({
	createdAt: true,
});

/**
 * ----------------
 * Update Schema
 * ----------------
 */

export const organizationMemberUpdateSchema = createUpdateSchema(
	dbSchema.member,
	{
		id: memberIdSchema,
		organizationId: organizationIdSchema,
		userId: userIdSchema,
	},
);

/**
 * ----------------
 * Delete Schema
 * ----------------
 */

export const organizationMemberDeleteSchema = z.object({
	organizationId: organizationMemberSelectSchema.shape.organizationId,
	refs: z.array(
		organizationMemberUpdateSchema.pick({
			userId: true,
		}),
	),
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
