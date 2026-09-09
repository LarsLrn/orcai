import { userIdSchema } from "@orcai/schema";
import { rejection } from "../../fixtures/authorization";
import { groupsName, systemGroup } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";

test("groups: the candidate list leaves out whoever is already a member", async ({
	api,
	org,
}) => {
	const group = await api.as("admin").group.create({
		name: groupsName("Candidates"),
	});
	const groupId = group.data.id;

	const offered = async (query?: string) =>
		(
			await api.as("admin").group.listCandidates({
				groupId,
				query,
				limit: 100,
			})
		).data.map((user) => user.id);

	expect(await offered()).toEqual(
		expect.arrayContaining([
			org.users.member.id,
			org.users.viewer.id,
		]),
	);

	await api.as("admin").group.addMembers({
		groupId,
		userIds: [
			org.users.member.id,
		],
	});

	expect(await offered()).not.toContain(org.users.member.id);
	expect(await offered()).toContain(org.users.viewer.id);

	// The fixture names users "E2E <role>".
	expect(await offered("E2E viewer")).toEqual([
		org.users.viewer.id,
	]);

	await api.as("admin").group.removeMembers({
		groupId,
		userIds: [
			org.users.member.id,
		],
	});
	expect(await offered()).toContain(org.users.member.id);

	// Everyone already belongs to the system group.
	const allMembers = await systemGroup(api.as("admin"));
	const forSystemGroup = await api.as("admin").group.listCandidates({
		groupId: allMembers.id,
		limit: 100,
	});
	expect(forSystemGroup.data).toEqual([]);

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});

test("groups: adding members lands whole, or not at all", async ({
	api,
	org,
}) => {
	const group = await api.as("admin").group.create({
		name: groupsName("Batch Members"),
	});
	const groupId = group.data.id;

	// One unknown user refuses the whole batch, including the known one.
	const stranger = userIdSchema.parse(crypto.randomUUID());
	const rejected = await rejection(
		api.as("admin").group.addMembers({
			groupId,
			userIds: [
				org.users.member.id,
				stranger,
			],
		}),
	);
	expect(rejected.code).toBe("BAD_REQUEST");
	expect(rejected.data).toEqual({
		code: "GROUP_MEMBERS_INVALID",
		userIds: [
			stranger,
		],
	});

	const members = await api.as("admin").group.listMembers({
		groupId,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(members.data).toEqual([]);

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});
