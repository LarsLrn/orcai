import { describe, expect, test } from "bun:test";
import type { GroupId, OrganizationRole } from "@orcai/core";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	appIntegration,
	outcomeOf,
	outcomesByRole,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, caller, organizationByRole } = appIntegration();

type Role = OrganizationRole;

const UNPRIVILEGED = [
	"member",
	"viewer",
] as const satisfies readonly Role[];

/** An organisation with its All Members group, one signed-in member per role, and the group procedures they call. */
const organization = async () => {
	const { as, zedToken, allMembersGroupId } = await organizationByRole();
	const procedures = await run(Procedures);
	const { call } = caller(zedToken);
	const groups = procedures.group;

	return {
		as,
		allMembersGroupId,
		create: (role: Role, name: string) =>
			call(as[role], (options) =>
				groups.create(
					{
						name,
					},
					options,
				),
			),
		list: (role: Role, search?: string) =>
			call(as[role], (options) =>
				groups.list(
					{
						pageIndex: 0,
						pageSize: 100,
						filters: {
							search,
						},
					},
					options,
				),
			),
		find: (role: Role, id: GroupId) =>
			call(as[role], (options) =>
				groups.find(
					{
						id,
					},
					options,
				),
			),
		listMembers: (role: Role, groupId: GroupId) =>
			call(as[role], (options) =>
				groups.listMembers(
					{
						groupId,
						pageIndex: 0,
						pageSize: 100,
					},
					options,
				),
			),
		update: (role: Role, id: GroupId, name: string) =>
			call(as[role], (options) =>
				groups.update(
					{
						id,
						name,
					},
					options,
				),
			),
		remove: (role: Role, id: GroupId) =>
			call(as[role], (options) =>
				groups.delete(
					{
						refs: [
							{
								id,
							},
						],
					},
					options,
				),
			),
		addMembers: (role: Role, groupId: GroupId, members: readonly Role[]) =>
			call(as[role], (options) =>
				groups.addMembers(
					{
						groupId,
						userIds: members.map((member) => as[member].user.id),
					},
					options,
				),
			),
		removeMembers: (role: Role, groupId: GroupId, members: readonly Role[]) =>
			call(as[role], (options) =>
				groups.removeMembers(
					{
						groupId,
						userIds: members.map((member) => as[member].user.id),
					},
					options,
				),
			),
	};
};

describe("group roles", () => {
	test(
		"members and viewers see only the groups they belong to, and another group is not found",
		async () => {
			const groups = await organization();
			const allMembers = String(groups.allMembersGroupId);
			const name = `Group of nobody ${crypto.randomUUID()}`;
			const { data: stranger } = await groups.create("admin", name);

			/** The listed groups as `kind:id`, and how many the list counts. */
			const listed = async (role: OrganizationRole, search?: string) => {
				const { data, rowCount } = await groups.list(role, search);
				return {
					groups: data.map((group) => `${group.kind}:${group.id}`).sort(),
					rowCount,
				};
			};

			for (const role of [
				"admin",
				"manager",
			] as const) {
				expect(await listed(role)).toEqual({
					groups: [
						`system:${allMembers}`,
						`custom:${stranger.id}`,
					].sort(),
					rowCount: 2,
				});
				expect((await groups.find(role, stranger.id)).data.id).toBe(
					stranger.id,
				);
			}

			for (const role of UNPRIVILEGED) {
				expect(await listed(role)).toEqual({
					groups: [
						`system:${allMembers}`,
					],
					rowCount: 1,
				});
				expect(await listed(role, name)).toEqual({
					groups: [],
					rowCount: 0,
				});
			}
			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.find(role, stranger.id),
					)
				).outcomes,
			).toEqual({
				member: "NotFoundError",
				viewer: "NotFoundError",
			});
			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.listMembers(role, stranger.id),
					)
				).outcomes,
			).toEqual({
				member: "NotFoundError",
				viewer: "NotFoundError",
			});

			await groups.addMembers("admin", stranger.id, [
				"member",
			]);

			expect(await listed("member", name)).toEqual({
				groups: [
					`custom:${stranger.id}`,
				],
				rowCount: 1,
			});
			const found = await outcomesByRole(UNPRIVILEGED, (role) =>
				groups.find(role, stranger.id),
			);
			expect(found.outcomes).toEqual({
				member: "allowed",
				viewer: "NotFoundError",
			});
			expect(found.responses.member?.data.id).toBe(stranger.id);
		},
		TIMEOUT,
	);

	test(
		"only managers and admins create, rename and delete a group",
		async () => {
			const groups = await organization();

			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.create(role, `Denied to ${role}`),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});

			const { data: created } = await groups.create(
				"manager",
				`Manager group ${crypto.randomUUID()}`,
			);
			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.update(role, created.id, `Renamed by ${role}`),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.remove(role, created.id),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});

			const name = `Renamed by the admin ${crypto.randomUUID()}`;
			expect((await groups.update("admin", created.id, name)).data.name).toBe(
				name,
			);
			expect((await groups.remove("manager", created.id)).success).toBe(true);
			expect(await outcomeOf(groups.find("admin", created.id))).toBe(
				"NotFoundError",
			);
		},
		TIMEOUT,
	);

	test(
		"only managers and admins add and remove group members",
		async () => {
			const groups = await organization();
			const { data: group } = await groups.create(
				"admin",
				`Membership group ${crypto.randomUUID()}`,
			);
			const memberIds = async () =>
				(await groups.listMembers("manager", group.id)).data.map(
					(member) => member.user.id,
				);

			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.addMembers(role, group.id, [
							"member",
						]),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			expect(await memberIds()).not.toContain(groups.as.member.user.id);

			await groups.addMembers("manager", group.id, [
				"member",
			]);
			expect(await memberIds()).toContain(groups.as.member.user.id);

			expect(
				(
					await outcomesByRole(UNPRIVILEGED, (role) =>
						groups.removeMembers(role, group.id, [
							"member",
						]),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			expect(await memberIds()).toContain(groups.as.member.user.id);

			expect(
				(
					await groups.removeMembers("admin", group.id, [
						"member",
					])
				).success,
			).toBe(true);
			expect(await memberIds()).not.toContain(groups.as.member.user.id);
		},
		TIMEOUT,
	);
});
