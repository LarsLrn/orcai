import { z } from "zod/v4";
import {
	groupIdSchema,
	organizationIdSchema,
	userIdSchema,
} from "../shared/ids";

const groupKindSchema = z.enum([
	"system",
	"custom",
]);

export const groupMemberSourceSchema = z.enum([
	"explicit",
	"implicit",
]);

const groupSystemKeySchema = z.enum([
	"all_members",
]);

export const ALL_MEMBERS_GROUP_SYSTEM_KEY = "all_members";

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
	createdBy: userIdSchema.nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});

export type Group = z.infer<typeof groupSchema>;
