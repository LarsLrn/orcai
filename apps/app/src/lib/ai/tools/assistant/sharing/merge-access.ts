import {
	type InheritedAccess,
	RESOURCE_GRANT_ORIGIN,
	type ResourceGrant,
	type ResourceGrantRole,
} from "@orcai/schema";

const roleOrder: Record<ResourceGrantRole, number> = {
	manager: 0,
	editor: 1,
	viewer: 2,
};

/** Direct grants, strongest role first, plus who reaches the resource through a bot or block above it. */
export const mergeAccess = (
	grants: ResourceGrant[],
	inherited: InheritedAccess,
) => ({
	grants: grants
		.map((grant) => ({
			type: "grant" as const,
			granteeType: grant.principal.type,
			granteeId: grant.principalId,
			name: grant.principal.name,
			...(grant.principal.type === "user" && grant.principal.email
				? {
						email: grant.principal.email,
					}
				: {}),
			role: grant.role,
			...(grant.origin === RESOURCE_GRANT_ORIGIN.DIRECT_GROUP_ALL_MEMBERS
				? {
						allMembers: true,
					}
				: {}),
		}))
		.sort(
			(left, right) =>
				roleOrder[left.role] - roleOrder[right.role] ||
				left.name.localeCompare(right.name),
		),
	total: grants.length,
	inherited:
		inherited.botCount + inherited.blockCount === 0
			? null
			: {
					through: inherited.ancestors.map((ancestor) => ({
						targetType: ancestor.resourceType,
						targetId: ancestor.resourceId,
						name: ancestor.name,
					})),
					hiddenCount: inherited.hiddenAncestorCount,
					groupCount: inherited.groupCount,
					userCount: inherited.userCount,
					public: inherited.throughPublic,
				},
});
