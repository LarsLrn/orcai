import { userIdSchema } from "@orcai/schema";
import { untilAllowed } from "../../fixtures/authorization";
import { templateBlock } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";

test("directory omits and cannot search emails for ordinary roles", async ({
	api,
	org,
	orgs,
}) => {
	const other = await orgs.create("Directory isolation");
	for (const role of [
		"member",
		"viewer",
		"manager",
	] as const) {
		const client = api.as(role);
		const groups = await untilAllowed(() =>
			client.group.list({
				pageIndex: 0,
				pageSize: 100,
			}),
		);
		const group = groups.data.find((item) => item.systemKey === "all_members");
		expect(group).toBeDefined();
		if (!group) throw new Error("Missing All Members group");
		const roster = await untilAllowed(() =>
			client.group.listMembers({
				groupId: group.id,
				pageIndex: 0,
				pageSize: 100,
			}),
		);
		expect(roster.data.some(({ user }) => user.id === org.users.admin.id)).toBe(
			true,
		);
		expect(
			roster.data.some(({ user }) => user.id === other.users.admin.id),
		).toBe(false);
		for (const row of roster.data)
			expect("email" in row.user).toBe(role === "manager");
		const emailSearch = await client.group.listMembers({
			groupId: group.id,
			query: org.users.admin.email,
			pageIndex: 0,
			pageSize: 100,
		});
		expect(emailSearch.rowCount).toBe(role === "manager" ? 1 : 0);
	}
	const member = api.as("member");
	const block = await untilAllowed(() =>
		member.block.create(templateBlock("Directory share")),
	);
	const principals = await untilAllowed(() =>
		member.resource.listPrincipals({
			resourceType: "block",
			resourceId: block.data.id,
			principalType: "user",
		}),
	);
	const colleague = principals.data.find(
		(principal) => principal.id === org.users.viewer.id,
	);
	expect(colleague).toBeDefined();
	expect(colleague).not.toHaveProperty("email");
	if (!colleague) throw new Error("Colleague not found");
	const named = await untilAllowed(() =>
		member.resource.listPrincipals({
			resourceType: "block",
			resourceId: block.data.id,
			principalType: "user",
			query: colleague.name,
		}),
	);
	expect(named.data.some((principal) => principal.id === colleague.id)).toBe(
		true,
	);
	expect(
		(
			await member.resource.listPrincipals({
				resourceType: "block",
				resourceId: block.data.id,
				query: org.users.viewer.email,
			})
		).rowCount,
	).toBe(0);
	const granted = await untilAllowed(() =>
		member.resource.grant({
			resourceType: "block",
			resourceId: block.data.id,
			principalType: "user",
			principalId: userIdSchema.parse(org.users.viewer.id),
			role: "viewer",
		}),
	);
	expect(granted.data.principal).not.toHaveProperty("email");
	const grants = await member.resource.listGrants({
		resourceType: "block",
		resourceId: block.data.id,
	});
	for (const grant of grants.data)
		expect(grant.principal).not.toHaveProperty("email");
});

test("literal wildcard searches do not broaden group discovery", async ({
	api,
}) => {
	const client = api.as("admin");
	const name = "Literal %_\\ marker";
	await untilAllowed(() =>
		client.group.create({
			name,
		}),
	);
	for (const search of [
		"%_\\",
		"LITERAL %",
	]) {
		const result = await client.group.list({
			filters: {
				search,
			},
			pageIndex: 0,
			pageSize: 100,
		});
		expect(result.data.map((group) => group.name)).toEqual([
			name,
		]);
	}
});
