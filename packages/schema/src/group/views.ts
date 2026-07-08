import { z } from "zod/v4";
import { userIdSchema } from "../user/ref";
import { groupMemberSourceSchema } from "./parts/member-source";

export const groupMemberUserSchema = z.object({
	id: userIdSchema,
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

export const groupMemberRowSchema = z.object({
	user: groupMemberUserSchema,
	source: groupMemberSourceSchema,
	addedAt: z.coerce.date().nullable(),
	addedBy: userIdSchema.nullable(),
});

export type GroupMemberUser = z.infer<typeof groupMemberUserSchema>;
export type GroupMemberRow = z.infer<typeof groupMemberRowSchema>;
