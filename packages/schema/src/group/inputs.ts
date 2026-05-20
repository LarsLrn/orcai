import { z } from "zod/v4";
import { paginationInputSchema } from "../shared";
import { userIdSchema } from "../user/ref";
import { groupIdSchema } from "./ref";
import {
	groupFieldsSchema,
	groupFiltersSchema,
	groupMutableFieldsSchema,
} from "./schema";

const groupUserIdsSchema = z
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
	});

export const listGroupsInputSchema = paginationInputSchema.extend({
	filters: groupFiltersSchema.optional(),
});

export const createGroupInputSchema = groupFieldsSchema;

export const updateGroupInputSchema = groupMutableFieldsSchema.extend({
	id: groupIdSchema,
});

export const deleteGroupsInputSchema = z.object({
	refs: z.array(
		z.object({
			id: groupIdSchema,
		}),
	),
});

export const findGroupInputSchema = z.object({
	id: groupIdSchema,
});

export const listGroupMembersInputSchema = paginationInputSchema.extend({
	groupId: groupIdSchema,
	query: z.string().trim().max(200).optional(),
});

export const addGroupMembersInputSchema = z.object({
	groupId: groupIdSchema,
	userIds: groupUserIdsSchema,
});

export const removeGroupMembersInputSchema = z.object({
	groupId: groupIdSchema,
	userIds: groupUserIdsSchema,
});

export type ListGroupsInput = z.infer<typeof listGroupsInputSchema>;
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>;
export type DeleteGroupsInput = z.infer<typeof deleteGroupsInputSchema>;
export type FindGroupInput = z.infer<typeof findGroupInputSchema>;
export type ListGroupMembersInput = z.infer<typeof listGroupMembersInputSchema>;
export type AddGroupMembersInput = z.infer<typeof addGroupMembersInputSchema>;
export type RemoveGroupMembersInput = z.infer<
	typeof removeGroupMembersInputSchema
>;
