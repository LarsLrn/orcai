import { z } from "zod/v4";
import { blockTypeSchema } from "../block/schema";
import { organizationRoleSchema } from "../organization/parts/role";
import { memberIdSchema, organizationIdSchema } from "../organization/ref";
import {
	assetResourceIdentitySchema,
	blockResourceIdentitySchema,
	botResourceIdentitySchema,
	RESOURCE_GRANT_SOURCE,
	type ResourceType,
	resourceGrantRoleSchema,
	resourceGrantSourceSchema,
} from "../resource/schema";
import { userIdSchema } from "../user/ref";

export const organizationMemberFieldsSchema = z.object({
	organizationId: organizationIdSchema,
	userId: userIdSchema,
	role: organizationRoleSchema,
});

export const organizationMemberMutableFieldsSchema =
	organizationMemberFieldsSchema
		.omit({
			organizationId: true,
			userId: true,
		})
		.partial();

export const organizationMemberSchema = organizationMemberFieldsSchema.extend({
	id: memberIdSchema,
	createdAt: z.coerce.date().nullable(),
});

export const MEMBER_ACCESS_SOURCE = {
	...RESOURCE_GRANT_SOURCE,
	INHERITED_ORGANIZATION: "inherited:organization",
} as const;

export const inheritedSourceByResourceType: Record<
	ResourceType,
	| typeof MEMBER_ACCESS_SOURCE.INHERITED_ORGANIZATION
	| z.infer<typeof resourceGrantSourceSchema>
> = {
	bot: MEMBER_ACCESS_SOURCE.INHERITED_ORGANIZATION,
	block: MEMBER_ACCESS_SOURCE.INHERITED_BOT,
	asset: MEMBER_ACCESS_SOURCE.INHERITED_BLOCK,
};

export const memberAccessSourceSchema = z.union([
	resourceGrantSourceSchema,
	z.literal(MEMBER_ACCESS_SOURCE.INHERITED_ORGANIZATION),
]);

const memberAccessFields = {
	role: resourceGrantRoleSchema,
	source: memberAccessSourceSchema,
	resourceName: z.string().nullable(),
};

export const memberAccessEntrySchema = z.discriminatedUnion("resourceType", [
	assetResourceIdentitySchema.extend(memberAccessFields),
	blockResourceIdentitySchema.extend({
		...memberAccessFields,
		blockType: blockTypeSchema,
	}),
	botResourceIdentitySchema.extend(memberAccessFields),
]);

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type MemberAccessEntry = z.infer<typeof memberAccessEntrySchema>;
export type MemberAccessSource = z.infer<typeof memberAccessSourceSchema>;
