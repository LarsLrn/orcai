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
	templateBlock,
} from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";

test("groups: a group grant opens a private block to the group's members", async ({
	api,
	org,
}) => {
	const name = groupsName("Grant");
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name,
		}),
	);
	const groupId = created.data.id;

	// The owner grants, so the owner is in the group: members share only with groups they belong to.
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				org.users.member.id,
				org.users.viewer.id,
			],
		}),
	);

	const blockName = groupsName("Granted Block");
	const block = await untilAllowed(() =>
		api.as("member").block.create(templateBlock(blockName)),
	);
	const resourceId = block.data.id;

	// Nothing is granted to the viewer yet, and a block is private on creation.
	await expectDenied(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);

	// `manage_access` on a block is owner plus manager, so the owner grants,
	// not the organisation's admin.
	const granted = await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
			role: "viewer",
		}),
	);
	expect(granted.data.principal.type).toBe("group");
	expect(granted.data.source).toBe("direct:group");

	const zedToken = granted.meta?.zedToken;

	const found = await untilAllowed(() =>
		api.as("viewer").block.find({
			id: resourceId,
			zedToken,
		}),
	);
	expect(found.data.id).toBe(resourceId);

	// Blocks come back newest first, so this one is on the first page whatever
	// else the run has accumulated.
	await expect(async () => {
		expect(
			await blockIds(
				api.as("viewer").block.list({
					pageIndex: 0,
					pageSize: 100,
					zedToken,
				}),
			),
		).toContain(resourceId);
	}).toPass({
		timeout: 15_000,
	});

	// A viewer grant reads, it does not write.
	await expectDenied(
		api.as("viewer").block.update({
			...templateBlock(`${blockName} By A Viewer`),
			id: resourceId,
		}),
	);

	await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
			role: "editor",
		}),
	);

	const editedName = `${blockName} Edited`;
	const updated = await untilAllowed(() =>
		api.as("viewer").block.update({
			...templateBlock(editedName),
			id: resourceId,
		}),
	);
	expect(updated.data.name).toBe(editedName);

	// Leaving the group closes the block again.
	await untilAllowed(() =>
		api.as("admin").group.removeMembers({
			groupId,
			userIds: [
				org.users.viewer.id,
			],
		}),
	);

	await expect(async () => {
		await expectDenied(
			api.as("viewer").block.find({
				id: resourceId,
			}),
		);
	}).toPass({
		timeout: 20_000,
	});
});

test("groups: revoking the group grant closes the block again", async ({
	api,
	org,
}) => {
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name: groupsName("Revoke"),
		}),
	);
	const groupId = created.data.id;

	// Owner grants, so the owner is in the group.
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				org.users.member.id,
				org.users.viewer.id,
			],
		}),
	);

	const block = await untilAllowed(() =>
		api.as("member").block.create(templateBlock(groupsName("Revoked Block"))),
	);
	const resourceId = block.data.id;

	const granted = await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
			role: "viewer",
		}),
	);

	const found = await untilAllowed(() =>
		api.as("viewer").block.find({
			id: resourceId,
			zedToken: granted.meta?.zedToken,
		}),
	);
	expect(found.data.id).toBe(resourceId);

	const revoked = await untilAllowed(() =>
		api.as("member").resource.revoke({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
		}),
	);
	expect(revoked.success).toBe(true);

	await expect(async () => {
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
	}).toPass({
		timeout: 20_000,
	});
});

test("groups: deleting a group revokes what it was granted", async ({
	api,
	org,
}) => {
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name: groupsName("Deleted"),
		}),
	);
	const groupId = created.data.id;

	// Owner grants, so the owner is in the group.
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				org.users.member.id,
				org.users.viewer.id,
			],
		}),
	);

	const block = await untilAllowed(() =>
		api.as("member").block.create(templateBlock(groupsName("Orphaned Block"))),
	);
	const resourceId = block.data.id;

	const granted = await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
			role: "viewer",
		}),
	);

	await untilAllowed(() =>
		api.as("viewer").block.find({
			id: resourceId,
			zedToken: granted.meta?.zedToken,
		}),
	);

	await untilAllowed(() =>
		api.as("admin").group.delete({
			refs: [
				{
					id: groupId,
				},
			],
		}),
	);

	await expect(async () => {
		await expectDenied(
			api.as("viewer").block.find({
				id: resourceId,
			}),
		);
	}).toPass({
		timeout: 20_000,
	});

	const grants = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId,
		}),
	);
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(groupId),
	);
});

test("groups: listPrincipals and listGrants reflect the group grants", async ({
	api,
	org,
}) => {
	const name = groupsName("Principals");
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name,
		}),
	);
	const groupId = created.data.id;

	// The member grants to this group, so it is one of theirs.
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				org.users.member.id,
			],
		}),
	);

	const block = await untilAllowed(() =>
		api.as("member").block.create(templateBlock(groupsName("Listed Block"))),
	);
	const resourceId = block.data.id;

	// A group of the organisation the block is scoped to is grantable.
	const principals = await untilAllowed(() =>
		api.as("member").resource.listPrincipals({
			resourceType: "block",
			resourceId,
			principalType: "group",
			query: name,
			limit: 25,
		}),
	);
	expect(principals.data.map((principal) => String(principal.id))).toContain(
		String(groupId),
	);
	expect(principals.data.every((principal) => principal.type === "group")).toBe(
		true,
	);

	// The block starts out with nothing but its owner, who is no grant.
	const before = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId,
		}),
	);
	expect(before.data.map((grant) => String(grant.principalId))).not.toContain(
		String(groupId),
	);

	await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
			role: "editor",
		}),
	);

	const afterGrant = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId,
		}),
	);
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
	const remaining = await untilAllowed(() =>
		api.as("member").resource.listPrincipals({
			resourceType: "block",
			resourceId,
			principalType: "group",
			query: name,
			limit: 25,
		}),
	);
	expect(remaining.data.map((principal) => String(principal.id))).toContain(
		String(groupId),
	);

	// A member who is not in the group does not get it offered, and cannot
	// grant to it: members share with the groups they belong to, plus All
	// Members.
	const outsider = await outsiderMember({
		admin: api.asWellKnownAdmin(),
		organisation: org,
	});
	const outsiderBlock = await untilAllowed(() =>
		outsider.client.block.create(templateBlock(groupsName("Outsider Block"))),
	);

	const outsiderPrincipals = await untilAllowed(() =>
		outsider.client.resource.listPrincipals({
			resourceType: "block",
			resourceId: outsiderBlock.data.id,
			principalType: "group",
			query: name,
			limit: 25,
		}),
	);
	expect(
		outsiderPrincipals.data.map((principal) => String(principal.id)),
	).not.toContain(String(groupId));

	// All Members stays on offer, so the empty list is the rule and not a
	// broken query.
	const outsiderAllMembers = await untilAllowed(() =>
		outsider.client.resource.listPrincipals({
			resourceType: "block",
			resourceId: outsiderBlock.data.id,
			principalType: "group",
			limit: 25,
		}),
	);
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
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				userIdSchema.parse(outsider.userId),
			],
		}),
	);

	const outsiderGrant = await untilAllowed(() =>
		outsider.client.resource.grant({
			resourceType: "block",
			resourceId: outsiderBlock.data.id,
			principalType: "group",
			principalId: groupId,
			role: "viewer",
		}),
	);
	expect(outsiderGrant.data.principal.type).toBe("group");

	// A grant to the system group is reported as the "All Members" source.
	const groups = await untilAllowed(() =>
		api.as("admin").group.list({
			pageIndex: 0,
			pageSize: 100,
		}),
	);
	const systemGroup = groups.data.find(
		(candidate) => candidate.kind === "system",
	);

	if (!systemGroup) {
		throw new Error("The organisation has no system group.");
	}

	await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: systemGroup.id,
			role: "viewer",
		}),
	);

	const withSystemGroup = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId,
		}),
	);
	const systemGrant = withSystemGroup.data.find(
		(candidate) => String(candidate.principalId) === String(systemGroup.id),
	);
	expect(systemGrant?.source).toBe("direct:group:all_members");

	// Every member of the organisation reads it through that group.
	await untilAllowed(() =>
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);

	await untilAllowed(() =>
		api.as("member").resource.revoke({
			resourceType: "block",
			resourceId,
			principalType: "group",
			principalId: groupId,
		}),
	);

	const afterRevoke = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId,
		}),
	);
	const afterRevokeIds = afterRevoke.data.map((candidate) =>
		String(candidate.principalId),
	);
	expect(afterRevokeIds).not.toContain(String(groupId));
	expect(afterRevokeIds).toContain(String(systemGroup.id));

	await untilAllowed(() =>
		api.as("admin").group.delete({
			refs: [
				{
					id: groupId,
				},
			],
		}),
	);
});
