import { userIdSchema } from "@orcai/schema";
import {
	expectDenied,
	rejection,
	untilAllowed,
} from "../../fixtures/authorization";
import {
	blockIds,
	groupsName,
	inheritanceChain,
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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
		role: "viewer",
	});
	expect(granted.data).toHaveLength(1);
	expect(granted.data[0]?.principal.type).toBe("group");
	expect(granted.data[0]?.source).toBe("direct:group");

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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
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

	const refused = await rejection(
		outsider.client.resource.grant({
			resourceType: "block",
			resourceId: outsiderBlock.data.id,
			principals: [
				{
					principalType: "group",
					principalId: groupId,
				},
			],
			role: "viewer",
		}),
	);
	expect(refused.code).toBe("BAD_REQUEST");
	expect(refused.message).toContain("groups you belong to");

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
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
		role: "viewer",
	});
	expect(outsiderGrant.data[0]?.principal.type).toBe("group");

	// A grant to the system group is reported as the "All Members" source.
	const allMembers = await systemGroup(api.as("admin"));

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "group",
				principalId: allMembers.id,
			},
		],
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

test("groups: the principal list leaves out whoever already holds a grant", async ({
	api,
	org,
}) => {
	const groupName = groupsName("Exclude Granted");
	const group = await api.as("admin").group.create({
		name: groupName,
	});
	const groupId = group.data.id;

	// A member is only offered, and only allowed to grant to, the groups they
	// belong to.
	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
		],
	});

	const blockName = groupsName("Exclude Granted Block");
	const block = await api.as("member").block.create(templateBlock(blockName));
	const resourceId = block.data.id;

	const offered = async (principalType: "group" | "user") =>
		(
			await api.as("member").resource.listPrincipals({
				resourceType: "block",
				resourceId,
				principalType,
				limit: 100,
				excludeGranted: true,
			})
		).data.map((principal) => String(principal.id));

	expect(await offered("group")).toContain(String(groupId));
	expect(await offered("user")).toContain(String(org.users.viewer.id));

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
		],
		role: "viewer",
	});
	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "user",
				principalId: org.users.viewer.id,
			},
		],
		role: "viewer",
	});

	// Excluding happens in SQL, so a granted principal is gone from the page
	// rather than filtered out of it afterwards.
	expect(await offered("group")).not.toContain(String(groupId));
	expect(await offered("user")).not.toContain(String(org.users.viewer.id));

	// Revoking puts them back on offer.
	await api.as("member").resource.revoke({
		resourceType: "block",
		resourceId,
		principalType: "group",
		principalId: groupId,
	});
	expect(await offered("group")).toContain(String(groupId));

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});

test("groups: a batch grant lands whole, or not at all", async ({
	api,
	org,
}) => {
	const groupName = groupsName("Batch");
	const group = await api.as("admin").group.create({
		name: groupName,
	});
	const groupId = group.data.id;

	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
		],
	});

	const blockName = groupsName("Batch Block");
	const block = await api.as("member").block.create(templateBlock(blockName));
	const resourceId = block.data.id;

	const granted = await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "group",
				principalId: groupId,
			},
			{
				principalType: "user",
				principalId: org.users.viewer.id,
			},
		],
		role: "viewer",
	});

	expect(granted.data).toHaveLength(2);
	expect(granted.rowCount).toBe(2);

	const listed = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	const grantedIds = listed.data.map((grant) => String(grant.principalId));
	expect(grantedIds).toContain(String(groupId));
	expect(grantedIds).toContain(String(org.users.viewer.id));

	// One bad principal in the batch rejects all of it: the good grant that
	// travelled with it must not be written.
	const rejected = await rejection(
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principals: [
				{
					principalType: "user",
					principalId: org.users.manager.id,
				},
				{
					principalType: "user",
					principalId: userIdSchema.parse(crypto.randomUUID()),
				},
			],
			role: "editor",
		}),
	);
	expect(rejected.code).toBe("BAD_REQUEST");
	expect(rejected.message).toContain("GRANT_PRINCIPALS_INVALID");
	expect(rejected.message).toContain("organization scope");

	const after = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	expect(after.data.map((grant) => String(grant.principalId))).not.toContain(
		String(org.users.manager.id),
	);

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});

test("groups: a batch that would demote the last manager writes nothing", async ({
	api,
	org,
}) => {
	const blockName = groupsName("Last Manager Block");
	const block = await api.as("member").block.create(templateBlock(blockName));
	const resourceId = block.data.id;

	// The block's only manager grant, so demoting it trips the manager floor.
	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "user",
				principalId: org.users.manager.id,
			},
		],
		role: "manager",
	});

	// The precheck passes every principal here; only the transaction can see
	// that the batch demotes the last manager. The viewer grant travelling
	// with it must roll back too.
	const rejected = await rejection(
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId,
			principals: [
				{
					principalType: "user",
					principalId: org.users.manager.id,
				},
				{
					principalType: "user",
					principalId: org.users.viewer.id,
				},
			],
			role: "viewer",
		}),
	);
	expect(rejected.code).toBe("BAD_REQUEST");
	expect(rejected.message).toContain("manager must remain");

	const after = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId,
	});
	expect(after.data).toHaveLength(1);
	expect(after.data[0]?.role).toBe("manager");
	expect(String(after.data[0]?.principalId)).toBe(String(org.users.manager.id));
});

test("groups: a block reports the access it inherits from its bot", async ({
	api,
	org,
}) => {
	const groupName = groupsName("Inherited");
	const group = await api.as("admin").group.create({
		name: groupName,
	});
	await api.as("admin").group.addMembers({
		groupId: group.data.id,
		userIds: [
			org.users.member.id,
		],
	});

	const chain = await inheritanceChain({
		api: api.as("member"),
		label: "Inherited",
	});

	// The chain is in place before anything is shared. The bot's own creator
	// holds an `owner` relation rather than a grant row, so the summary counts
	// nobody yet: it reports who a resource is shared with, not who owns it.
	const before = await api.as("member").resource.inheritedAccess({
		resourceType: "block",
		resourceId: chain.templateBlockId,
	});
	expect(before.data.botCount).toBe(1);
	expect(before.data.groupCount).toBe(0);
	expect(before.data.userCount).toBe(0);

	await api.as("member").resource.grant({
		resourceType: "bot",
		resourceId: chain.botId,
		principals: [
			{
				principalType: "group",
				principalId: group.data.id,
			},
		],
		role: "viewer",
	});

	const own = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId: chain.templateBlockId,
	});
	const after = await api.as("member").resource.inheritedAccess({
		resourceType: "block",
		resourceId: chain.templateBlockId,
	});

	// The grant lives on the bot, so the block's own list stays empty while the
	// summary reports who reaches it anyway.
	expect(own.data).toHaveLength(0);
	expect(after.data.botCount).toBe(1);
	expect(after.data.groupCount).toBe(1);
	expect(after.data.ancestors.map((ancestor) => ancestor.name)).toContain(
		chain.botName,
	);
	expect(after.data.hiddenAncestorCount).toBe(0);
	expect(after.data.throughPublic).toBe(false);

	await api.as("admin").group.delete({
		refs: [
			{
				id: group.data.id,
			},
		],
	});
});

test("groups: an asset reports access inherited two hops up", async ({
	api,
}) => {
	const chain = await inheritanceChain({
		api: api.as("member"),
		label: "Two Hop",
	});

	const inherited = (
		await api.as("member").resource.inheritedAccess({
			resourceType: "asset",
			resourceId: chain.assetId,
		})
	).data;

	// `asset.read` includes `block->read`, which includes `bot->read`, so the
	// walk has to climb past the database block to the bot above it.
	expect(inherited.blockCount).toBe(1);
	expect(inherited.botCount).toBe(1);
	expect(inherited.ancestors.map((ancestor) => ancestor.resourceType)).toEqual(
		expect.arrayContaining([
			"bot",
			"block",
		]),
	);
});
