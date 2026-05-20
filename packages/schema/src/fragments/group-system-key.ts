import { z } from "zod/v4";

export const groupSystemKeySchema = z.enum([
	"all_members",
]);

export const ALL_MEMBERS_GROUP_SYSTEM_KEY = "all_members";

export type GroupSystemKey = z.infer<typeof groupSystemKeySchema>;
