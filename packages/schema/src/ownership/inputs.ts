import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { createResourceScopedSchema } from "../resource/schema";
import { userIdSchema } from "../user/ref";

const ownersSchema = userIdSchema.array().min(1).max(100);
const receiverSearchSchema = z.string().trim().max(200).optional();

export const listOwnedContentInputSchema = z.object({
	userIds: ownersSchema,
});

export const listContentReceiversInputSchema = z.object({
	search: receiverSearchSchema,
});

export const listInstanceOwnedContentInputSchema = z.object({
	userIds: ownersSchema,
	/** One organisation, for a removal or role change there; every one when left out, for a deletion. */
	organizationId: organizationIdSchema.optional(),
});

export const listInstanceContentReceiversInputSchema = z.object({
	organizationId: organizationIdSchema,
	search: receiverSearchSchema,
});

export const resourceHandOverInputSchema = createResourceScopedSchema({
	receiverId: userIdSchema,
});

export const resourceListReceiversInputSchema = createResourceScopedSchema({
	search: receiverSearchSchema,
});

export type ListOwnedContentInput = z.infer<typeof listOwnedContentInputSchema>;
export type ListContentReceiversInput = z.infer<
	typeof listContentReceiversInputSchema
>;
export type ListInstanceOwnedContentInput = z.infer<
	typeof listInstanceOwnedContentInputSchema
>;
export type ListInstanceContentReceiversInput = z.infer<
	typeof listInstanceContentReceiversInputSchema
>;
export type ResourceHandOverInput = z.infer<typeof resourceHandOverInputSchema>;
export type ResourceListReceiversInput = z.infer<
	typeof resourceListReceiversInputSchema
>;
