import { dbSchema } from "@orcai/db/schema";
import {
	groupIdSchema,
	groupMemberIdSchema,
	organizationIdSchema,
	paginationInputSchema,
	statusResponseSchema,
	userIdSchema,
} from "@orcai/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { userSelectSchema } from "./user";

export const groupSelectSchema = createSelectSchema(dbSchema.group, {
	id: groupIdSchema,
	organizationId: organizationIdSchema,
	createdBy: userIdSchema,
});

export const groupMemberSelectSchema = createSelectSchema(
	dbSchema.groupMember,
	{
		id: groupMemberIdSchema,
		groupId: groupIdSchema,
		userId: userIdSchema,
		addedBy: userIdSchema,
	},
);

export const groupInsertSchema = createInsertSchema(dbSchema.group).pick({
	name: true,
	description: true,
});

export const groupUpdateSchema = createUpdateSchema(dbSchema.group, {
	id: groupIdSchema,
}).pick({
	id: true,
	name: true,
	description: true,
});

export const groupDeleteSchema = z.object({
	refs: z.array(
		groupSelectSchema.pick({
			id: true,
		}),
	),
});

export const groupMemberRowSchema = z.object({
	user: userSelectSchema.pick({
		id: true,
		name: true,
		email: true,
		image: true,
	}),
	source: z.enum([
		"explicit",
		"implicit",
	]),
	addedAt: z.coerce.date().nullable(),
	addedBy: userIdSchema.nullable(),
});

export const groupListMembersInputSchema = paginationInputSchema.extend({
	groupId: groupIdSchema,
	query: z.string().trim().max(200).optional(),
});

export const groupFindInputSchema = groupSelectSchema.pick({
	id: true,
});

export const groupAddMembersInputSchema = z.object({
	groupId: groupIdSchema,
	userIds: z
		.array(userIdSchema)
		.min(1)
		.max(500)
		.check((ctx) => {
			const uniqueCount = new Set(ctx.value).size;
			if (uniqueCount !== ctx.value.length) {
				ctx.issues.push({
					code: "custom",
					message: "User IDs must be unique",
					path: [
						"userIds",
					],
					input: "",
				});
			}
		}),
});

export const groupRemoveMembersInputSchema = z.object({
	groupId: groupIdSchema,
	userIds: z.array(userIdSchema).min(1).max(500),
});

export const groupListResponseSchema = z.object({
	data: z.array(groupSelectSchema),
	rowCount: z.number(),
});

export const groupFindResponseSchema = z.object({
	data: groupSelectSchema,
});

export const groupWriteResponseSchema = z.object({
	data: groupSelectSchema,
});

export const groupListMembersResponseSchema = z.object({
	data: z.array(groupMemberRowSchema),
	rowCount: z.number(),
});

export const groupMembersMutateResponseSchema = statusResponseSchema;

export type Group = z.infer<typeof groupSelectSchema>;
export type GroupInsert = z.infer<typeof groupInsertSchema>;
export type GroupUpdate = z.infer<typeof groupUpdateSchema>;
export type GroupDelete = z.infer<typeof groupDeleteSchema>;
export type GroupMemberRow = z.infer<typeof groupMemberRowSchema>;
