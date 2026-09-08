import { userIdSchema } from "@orcai/schema";
import {
	expectDenied,
	expectForbidden,
	untilAllowed,
} from "../../fixtures/authorization";
import {
	blockIds,
	groupsName,
	outsiderMember,
	systemGroup,
	templateBlock,
} from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";

test("groups: a group grant opens a private block to the group's members", async ({
	api,
	org,
}) => {
	const name = groupsName("Grant");
	const created = await api.as("admin").group.create({
		name,
	});
	const groupId = created.data.id;

	// The owner grants, so the owner is in the group: members share only with groups they belong to.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
			org.users.viewer.id,
		],
	});

	const blockName = groupsName("Granted Block");
	const block = await api.as("member").block.create(templateBlock(blockName));
	const resourceId = block.data.id;

	// Nothing is granted to the viewer yet, and a block is private on creation.
	await expectDenied(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);

	// `manage_access` on a block is owner plus manager, so the owner grants,
	// not the organisation's admin.
	const granted = await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
		role: "viewer",
	});
	expect(granted.data.principal.type).toBe("group");
	expect(granted.data.source).toBe("direct:group");

	const found = await api.as("viewer").block.find({
		id: resourceId,
	});
	expect(found.data.id).toBe(resourceId);

	// Blocks come back newest first, so this one is on the first page whatever
	// else the run has accumulated.
	expect(
		await blockIds(
			api.as("viewer").block.list({
				pageIndex: 0,
				pageSize: 100,
			}),
		),
	).toContain(resourceId);

	// A viewer grant reads, it does not write.
	await expectDenied(
		api.as("viewer").block.update({
			...templateBlock(`${blockName} By A Viewer`),
			id: resourceId,
		}),
	);

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
		role: "editor",
	});

	const editedName = `${blockName} Edited`;
	const updated = await api.as("viewer").block.update({
		...templateBlock(editedName),
		id: resourceId,
	});
	expect(updated.data.name).toBe(editedName);

	// Leaving the group closes the block again.
	await api.as("admin").group.removeMembers({
		groupId,
		userIds: [
			org.users.viewer.id,
		],
	});

	await expectDenied(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);
});

test("groups: revoking the group grant closes the block again", async ({
	api,
	org,
}) => {
	const created = await api.as("admin").group.create({
		name: groupsName("Revoke"),
	});
	const groupId = created.data.id;

	// Owner grants, so the owner is in the group.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
			org.users.viewer.id,
		],
	});

	const block = await api
		.as("member")
		.block.create(templateBlock(groupsName("Revoked Block")));
	const resourceId = block.data.id;

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
		role: "viewer",
	});

	const found = await api.as("viewer").block.find({
		id: resourceId,
	});
	expect(found.data.id).toBe(resourceId);

	const revoked = await api.as("member").resource.revoke({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
	});
	expect(revoked.success).toBe(true);

	await expectDenied(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);
	expect(
		await blockIds(
			api.as("viewer").block.list({
				pageIndex: 0,
				pageSize: 100,
			}),
		),
	).not.toContain(resourceId);
});

test("groups: deleting a group revokes what it was granted", async ({
	api,
	org,
}) => {
	const created = await api.as("admin").group.create({
		name: groupsName("Deleted"),
	});
	const groupId = created.data.id;

	// Owner grants, so the owner is in the group.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
			org.users.viewer.id,
		],
	});

	const block = await api
		.as("member")
		.block.create(templateBlock(groupsName("Orphaned Block")));
	const resourceId = block.data.id;

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
		role: "viewer",
	});

	await api.as("viewer").block.find({
		id: resourceId,
	});

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});

	await expectDenied(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);

	const grants = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(groupId),
	);
});

test("groups: listPrincipals and listGrants reflect the group grants", async ({
	api,
	org,
	zedTokens,
}) => {
	const name = groupsName("Principals");
	const created = await api.as("admin").group.create({
		name,
	});
	const groupId = created.data.id;

	// The member grants to this group, so it is one of theirs.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
		],
	});

	const block = await api
		.as("member")
		.block.create(templateBlock(groupsName("Listed Block")));
	const resourceId = block.data.id;

	// A group of the organisation the block is scoped to is grantable.
	const principals = await api.as("member").resource.listPrincipals({
		resourceType: "block",
		resourceId,
		principalType: "group",
		query: name,
		limit: 25,
	});
	expect(principals.data.map((principal) => String(principal.id))).toContain(
		String(groupId),
	);
	expect(principals.data.every((principal) => principal.type === "group")).toBe(
		true,
	);

	// The block starts out with nothing but its owner, who is no grant.
	const before = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	expect(before.data.map((grant) => String(grant.principalId))).not.toContain(
		String(groupId),
	);

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
		role: "editor",
	});

	const afterGrant = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	const grant = afterGrant.data.find(
		(candidate) => String(candidate.principalId) === String(groupId),
	);
	expect(grant).toBeDefined();
	expect(grant?.principalType).toBe("group");
	expect(grant?.role).toBe("editor");
	expect(grant?.source).toBe("direct:group");
	expect(grant?.principal.name).toBe(name);

	// `listPrincipals` keeps reporting the group; the access manager is what
	// hides principals that already hold a grant.
	const remaining = await api.as("member").resource.listPrincipals({
		resourceType: "block",
		resourceId,
		principalType: "group",
		query: name,
		limit: 25,
	});
	expect(remaining.data.map((principal) => String(principal.id))).toContain(
		String(groupId),
	);

	// A member who is not in the group does not get it offered, and cannot
	// grant to it: members share with the groups they belong to, plus All
	// Members.
	const outsider = await outsiderMember({
		admin: api.asWellKnownAdmin(),
		organisation: org,
		zedTokens,
	});
	// The sign-up hook makes the new user a member, and no response carries the
	// token of that write.
	const outsiderBlock = await untilAllowed(() =>
		outsider.client.block.create(templateBlock(groupsName("Outsider Block"))),
	);

	const outsiderPrincipals = await outsider.client.resource.listPrincipals({
		resourceType: "block",
		resourceId: outsiderBlock.data.id,
		principalType: "group",
		query: name,
		limit: 25,
	});
	expect(
		outsiderPrincipals.data.map((principal) => String(principal.id)),
	).not.toContain(String(groupId));

	// All Members stays on offer, so the empty list is the rule and not a
	// broken query.
	const outsiderAllMembers = await outsider.client.resource.listPrincipals({
		resourceType: "block",
		resourceId: outsiderBlock.data.id,
		principalType: "group",
		limit: 25,
	});
	expect(
		outsiderAllMembers.data.some(
			(principal) => principal.type === "group" && principal.kind === "system",
		),
	).toBe(true);

	await expectForbidden(
		outsider.client.resource.grant({
			resourceType: "block",
			resourceId: outsiderBlock.data.id,
			principalType: "group",
			principalId: groupId,
			role: "viewer",
		}),
	);

	// Added to the group, the same member may share with it.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			userIdSchema.parse(outsider.userId),
		],
	});

	const outsiderGrant = await outsider.client.resource.grant({
		resourceType: "block",
		resourceId: outsiderBlock.data.id,
		principalType: "group",
		principalId: groupId,
		role: "viewer",
	});
	expect(outsiderGrant.data.principal.type).toBe("group");

	// A grant to the system group is reported as the "All Members" source.
	const allMembers = await systemGroup(api.as("admin"));

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: allMembers.id,
		role: "viewer",
	});

	const withSystemGroup = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	const systemGrant = withSystemGroup.data.find(
		(candidate) => String(candidate.principalId) === String(allMembers.id),
	);
	expect(systemGrant?.source).toBe("direct:group:all_members");

	// Every member of the organisation reads it through that group.
	await api.as("viewer").block.find({
		id: resourceId,
	});

	await api.as("member").resource.revoke({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
	});

	const afterRevoke = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	const afterRevokeIds = afterRevoke.data.map((candidate) =>
		String(candidate.principalId),
	);
	expect(afterRevokeIds).not.toContain(String(groupId));
	expect(afterRevokeIds).toContain(String(allMembers.id));

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});
