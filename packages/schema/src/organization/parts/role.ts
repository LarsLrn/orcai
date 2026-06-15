import { z } from "zod/v4";

export const organizationRoleSchema = z.enum([
	"owner",
	"instructor",
	"student",
]);

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
