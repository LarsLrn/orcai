import { z } from "zod/v4";
import { zedTokenSchema } from "../shared";
import {
	capabilityEntityTypeSchema,
	capabilitySchema,
	organizationCapabilitySchema,
} from "./schema";

export const authorizationCheckInputSchema = z.object({
	entityType: capabilityEntityTypeSchema,
	entityId: z.string(),
	permission: capabilitySchema,
	...zedTokenSchema.shape,
});

export const authorizationCheckManyInputSchema = z.object({
	entityType: capabilityEntityTypeSchema,
	entityIds: z.array(z.string()).min(1),
	permissions: z.array(capabilitySchema).min(1),
	...zedTokenSchema.shape,
});

export const organizationCapabilitiesInputSchema = z.object({
	permissions: z.array(organizationCapabilitySchema).optional(),
	...zedTokenSchema.shape,
});

export type AuthorizationCheckInput = z.infer<
	typeof authorizationCheckInputSchema
>;
export type AuthorizationCheckManyInput = z.infer<
	typeof authorizationCheckManyInputSchema
>;
export type OrganizationCapabilitiesInput = z.infer<
	typeof organizationCapabilitiesInputSchema
>;
