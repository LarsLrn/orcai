import { z } from "zod/v4";
import { blockTypeSchema } from "../block/schema";
import { organizationRoleSchema } from "../organization/schema";
import {
	assetResourceIdentitySchema,
	blockResourceIdentitySchema,
	botResourceIdentitySchema,
	RESOURCE_GRANT_ORIGIN,
	type ResourceType,
	resourceGrantOriginSchema,
	resourceGrantRoleSchema,
} from "../resource/schema";
import {
	memberIdSchema,
	organizationIdSchema,
	userIdSchema,
} from "../shared/ids";
import { userSchema } from "../user/schema";

const organizationMemberFieldsSchema = z.object({
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

/** A member as organisation managers see them: no account moderation details or preferences. */
export const organizationMemberUserSchema = userSchema
	.pick({
		id: true,
		name: true,
		email: true,
		emailVerified: true,
		image: true,
		banned: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		organizationRole: organizationRoleSchema,
	});

export type OrganizationMemberUser = z.infer<
	typeof organizationMemberUserSchema
>;

export const MEMBER_ACCESS_ORIGIN = {
	...RESOURCE_GRANT_ORIGIN,
	INHERITED_ORGANIZATION: "inherited:organization",
} as const;

export const inheritedOriginByResourceType: Record<
	ResourceType,
	| typeof MEMBER_ACCESS_ORIGIN.INHERITED_ORGANIZATION
	| z.infer<typeof resourceGrantOriginSchema>
> = {
	bot: MEMBER_ACCESS_ORIGIN.INHERITED_ORGANIZATION,
	block: MEMBER_ACCESS_ORIGIN.INHERITED_BOT,
	asset: MEMBER_ACCESS_ORIGIN.INHERITED_BLOCK,
};

export const memberAccessOriginSchema = z.union([
	resourceGrantOriginSchema,
	z.literal(MEMBER_ACCESS_ORIGIN.INHERITED_ORGANIZATION),
]);

const memberAccessFields = {
	role: resourceGrantRoleSchema,
	origin: memberAccessOriginSchema,
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

export type MemberAccessEntry = z.infer<typeof memberAccessEntrySchema>;
export type MemberAccessOrigin = z.infer<typeof memberAccessOriginSchema>;
