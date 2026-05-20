import { z } from "zod/v4";

export const groupMemberSourceSchema = z.enum([
	"explicit",
	"implicit",
]);

export type GroupMemberSource = z.infer<typeof groupMemberSourceSchema>;
