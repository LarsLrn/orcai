import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";
import { groupKindSchema } from "./parts/kind";
import { groupSystemKeySchema } from "./parts/system-key";
import { groupIdSchema, groupMemberIdSchema } from "./ref";

export const groupFieldsSchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().nullable().optional(),
});

export const groupMutableFieldsSchema = groupFieldsSchema.partial();

export const groupFiltersSchema = z.object({
	search: z.string().trim().max(100).optional(),
});

export const groupSchema = groupFieldsSchema.extend({
	id: groupIdSchema,
	organizationId: organizationIdSchema,
	description: z.string().nullable(),
	kind: groupKindSchema,
	systemKey: groupSystemKeySchema.nullable(),
	createdBy: userIdSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});

export const groupMemberSchema = z.object({
	id: groupMemberIdSchema,
	groupId: groupIdSchema,
	userId: userIdSchema,
	addedBy: userIdSchema,
	createdAt: z.coerce.date(),
	removedAt: z.coerce.date().nullable(),
});

export type Group = z.infer<typeof groupSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
