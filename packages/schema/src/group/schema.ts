import type { GroupId, GroupMemberId } from "@orcai/core";
import { z } from "zod/v4";
import { groupKindSchema, groupSystemKeySchema } from "../fragments";
import { organizationIdSchema } from "../organization";
import { createUuidIdSchema } from "../shared";
import { userIdSchema } from "../user";

export const groupIdSchema = createUuidIdSchema<GroupId>();
export const groupMemberIdSchema = createUuidIdSchema<GroupMemberId>();

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
