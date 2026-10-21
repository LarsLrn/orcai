import type { GroupId, UserId } from "@orcai/core";
import { assetIdSchema, blockIdSchema, botIdSchema } from "@orcai/schema";
import type {
	GrantPrincipal,
	ResourceRef,
} from "@/lib/authz/relationship-facts";

/** The typed reference of a plain `(resourceType, resourceId)` row. */
export const scopedResourceRef = (resource: {
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
}): ResourceRef => {
	switch (resource.resourceType) {
		case "asset":
			return {
				resourceType: "asset",
				resourceId: assetIdSchema.parse(resource.resourceId),
			};
		case "block":
			return {
				resourceType: "block",
				resourceId: blockIdSchema.parse(resource.resourceId),
			};
		case "bot":
			return {
				resourceType: "bot",
				resourceId: botIdSchema.parse(resource.resourceId),
			};
	}
};

/** Recovers the branded resource id from a plain `(resourceType, resourceId)` row. */
export const parseScopedResourceId = (resource: {
	resourceType: "asset" | "block" | "bot";
	resourceId: string;
}) => scopedResourceRef(resource).resourceId;

/** The typed principal of a `resource_grant` row. */
export const grantPrincipal = (grant: {
	principalType: "user" | "group";
	principalId: UserId | GroupId;
}): GrantPrincipal =>
	grant.principalType === "group"
		? {
				principalType: "group",
				principalId: grant.principalId as GroupId,
			}
		: {
				principalType: "user",
				principalId: grant.principalId as UserId,
			};
