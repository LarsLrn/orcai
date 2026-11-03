import { z } from "zod/v4";
import { userIdSchema } from "../shared/ids";
import { groupMemberSourceSchema, groupSchema } from "./schema";

export const groupMemberUserSchema = z.object({
	id: userIdSchema,
	name: z.string(),
	email: z.string().optional(),
	image: z.string().nullable(),
});

export const groupMemberRowSchema = z.object({
	user: groupMemberUserSchema,
	source: groupMemberSourceSchema,
	addedAt: z.coerce.date().nullable(),
	addedBy: userIdSchema.nullable(),
});

export const groupListRowSchema = groupSchema.extend({
	memberCount: z.number().int().nonnegative(),
});

export type GroupListRow = z.infer<typeof groupListRowSchema>;
export type GroupMemberUser = z.infer<typeof groupMemberUserSchema>;
export type GroupMemberRow = z.infer<typeof groupMemberRowSchema>;
