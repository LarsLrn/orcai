import type { OrganizationId, UserId } from "@orcai/core";
import { dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { type SQL, sql } from "drizzle-orm";

type Reached = {
	userId: UserId;
	organizationId?: OrganizationId;
};

/**
 * The groups whose grants reach the user: joined ones and the All Members of
 * their organisations, in one organisation when given.
 */
const reachingGroupIds = ({ userId, organizationId }: Reached) => {
	const { group, groupMember, member } = dbSchema;
	return sql`(
		select ${group.id} from ${group}
		where ${group.deletedAt} is null
			${organizationId ? sql`and ${group.organizationId} = ${organizationId}` : sql``}
			and (
				exists (
					select 1 from ${groupMember}
					where ${groupMember.groupId} = ${group.id}
						and ${groupMember.userId} = ${userId}
						and ${groupMember.removedAt} is null
				)
				or (
					${group.kind} = 'system'
					and ${group.systemKey} = ${ALL_MEMBERS_GROUP_SYSTEM_KEY}
					and exists (
						select 1 from ${member}
						where ${member.organizationId} = ${group.organizationId}
							and ${member.userId} = ${userId}
					)
				)
			)
	)`;
};

/** Whether the `resource_grant` row in scope goes to the user or a group reaching them. */
export const grantReaches = (reached: Reached): SQL => {
	const grant = dbSchema.resourceGrant;
	return sql`(
		(${grant.principalType} = 'user' and ${grant.principalId} = ${reached.userId})
		or (${grant.principalType} = 'group' and ${grant.principalId} in ${reachingGroupIds(reached)})
	)`;
};
