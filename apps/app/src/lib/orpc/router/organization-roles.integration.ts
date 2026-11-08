import { describe, expect, test } from "bun:test";
import {
	ORGANIZATION_ROLES,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	outcomeOf,
	outcomesByRole,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, caller, organizationByRole, instanceAdmin } = appIntegration();

const ROLES = ORGANIZATION_ROLES;

/**
 * An organisation with one signed-in member per role, then members in
 * `targetRoles` to aim membership changes at, and the procedures they call
 * at the newest token.
 */
const organization = async (targetRoles: readonly OrganizationRole[] = []) => {
	const { organizationId, slug, as, others, zedToken } =
		await organizationByRole(targetRoles);
	const { call } = caller(zedToken);
	return {
		organizationId,
		slug,
		as,
		targets: others.map((actor) => actor.user.id),
		procedures: await run(Procedures),
		call,
	};
};

describe("organisation roles", () => {
	test(
		"every role reads its organisation, managers and admins list its members, and members and viewers find themselves",
		async () => {
			const { organizationId, slug, procedures, call, as } =
				await organization();

			const found = await outcomesByRole(ROLES, (role) =>
				call(as[role], (options) =>
					procedures.organization.find(
						{
							id: organizationId,
						},
						options,
					),
				),
			);
			expect(found.outcomes).toEqual({
				admin: "allowed",
				manager: "allowed",
				member: "allowed",
				viewer: "allowed",
			});
			for (const role of ROLES)
				expect(found.responses[role]?.data.slug).toBe(slug);

			const list = (role: OrganizationRole) =>
				call(as[role], (options) =>
					procedures.organizationMember.list(
						{
							pageIndex: 0,
							pageSize: 100,
						},
						options,
					),
				);
			const listed = await outcomesByRole(ROLES, list);
			expect(listed.outcomes).toEqual({
				admin: "allowed",
				manager: "allowed",
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			for (const role of [
				"admin",
				"manager",
			] as const) {
				expect(listed.responses[role]?.rowCount).toBe(ROLES.length);
				expect(
					listed.responses[role]?.data.map((member) => member.id).sort(),
				).toEqual(ROLES.map((member) => as[member].user.id).sort());
			}

			for (const role of [
				"member",
				"viewer",
			] as const) {
				const self = await call(as[role], (options) =>
					procedures.organizationMember.find(
						{
							userId: as[role].user.id,
						},
						options,
					),
				);
				expect(self.data.organizationRole).toBe(role);
			}
		},
		TIMEOUT,
	);

	test(
		"only an admin changes the organisation or removes its logo",
		async () => {
			const { organizationId, procedures, call, as } = await organization();
			const name = `Renamed ${crypto.randomUUID()}`;

			const updated = await outcomesByRole(
				[
					"manager",
					"member",
					"viewer",
					"admin",
				],
				(role) =>
					call(as[role], (options) =>
						procedures.organization.update(
							{
								id: organizationId,
								name,
							},
							options,
						),
					),
			);
			expect(updated.outcomes).toEqual({
				admin: "allowed",
				manager: "ForbiddenError",
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			expect(updated.responses.admin?.data).toMatchObject({
				id: organizationId,
				name,
			});

			const removed = await outcomesByRole(
				[
					"manager",
					"member",
					"viewer",
					"admin",
				],
				(role) =>
					call(as[role], (options) =>
						procedures.organization.removeLogo(
							{
								id: organizationId,
							},
							options,
						),
					),
			);
			expect(removed.outcomes).toEqual({
				admin: "allowed",
				manager: "ForbiddenError",
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			expect(removed.responses.admin?.success).toBe(true);

			const found = await call(as.viewer, (options) =>
				procedures.organization.find(
					{
						id: organizationId,
					},
					options,
				),
			);
			expect(found.data.name).toBe(name);
		},
		TIMEOUT,
	);

	test(
		"only the instance admin creates or deletes an organisation, and deleting it ends access",
		async () => {
			const { organizationId, slug, procedures, call, as } =
				await organization();
			const newSlug = () => `roles-${crypto.randomUUID()}`;

			expect(
				(
					await outcomesByRole(ROLES, (role) =>
						call(as[role], (options) =>
							procedures.organization.create(
								{
									name: `Created by ${role}`,
									slug: newSlug(),
									initialAdmin: {
										kind: "me",
									},
								},
								options,
							),
						),
					)
				).outcomes,
			).toEqual({
				admin: "ForbiddenError",
				manager: "ForbiddenError",
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});
			const remove = (actor: Actor) =>
				call(actor, (options) =>
					procedures.organization.delete(
						{
							refs: [
								{
									id: organizationId,
								},
							],
						},
						options,
					),
				);
			expect(
				(await outcomesByRole(ROLES, (role) => remove(as[role]))).outcomes,
			).toEqual({
				admin: "ForbiddenError",
				manager: "ForbiddenError",
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});

			const find = (actor: Actor) =>
				call(actor, (options) =>
					procedures.organization.find(
						{
							id: organizationId,
						},
						options,
					),
				);
			expect((await find(as.admin)).data.id).toBe(organizationId);

			await call(as.admin, (options) =>
				procedures.organizationInvitation.create(
					{
						role: "member",
						expiresAt: new Date(Date.now() + 86_400_000),
						items: [
							{
								email: `invitee-${crypto.randomUUID()}@example.test`,
							},
						],
					},
					options,
				),
			);

			// Like an instance admin who created the organisation, a member of it.
			const instance = await instanceAdmin(organizationId);
			await call(instance, (options) =>
				procedures.instance.addMember(
					{
						organizationId,
						userId: instance.user.id,
						role: "admin",
					},
					options,
				),
			);
			expect((await find(instance)).data.id).toBe(organizationId);
			const createdSlug = newSlug();
			const created = await call(instance, (options) =>
				procedures.organization.create(
					{
						name: "Created by the instance admin",
						slug: createdSlug,
						initialAdmin: {
							kind: "me",
						},
					},
					options,
				),
			);
			expect(created.data.slug).toBe(createdSlug);

			const impact = await call(instance, (options) =>
				procedures.organization.deletionImpact(
					{
						id: organizationId,
					},
					options,
				),
			);
			expect(impact.data).toMatchObject({
				slug,
				members: ROLES.length + 1,
				pendingInvitations: 1,
				groups: 1,
			});

			const deleted = await remove(instance);
			expect(deleted.success).toBe(true);
			expect(await outcomeOf(find(instance))).toBe("ForbiddenError");
			expect(await outcomeOf(find(as.admin))).toBe("ForbiddenError");
		},
		TIMEOUT,
	);
});

describe("organisation member roles", () => {
	const update = (
		context: Awaited<ReturnType<typeof organization>>,
		actor: Actor,
		userId: UserId,
		role: OrganizationRole,
	) =>
		context.call(actor, (options) =>
			context.procedures.organizationMember.update(
				{
					userId,
					role,
				},
				options,
			),
		);

	const remove = (
		context: Awaited<ReturnType<typeof organization>>,
		actor: Actor,
		userId: UserId,
	) =>
		context.call(actor, (options) =>
			context.procedures.organizationMember.delete(
				{
					refs: [
						{
							userId,
						},
					],
				},
				options,
			),
		);

	test(
		"only managers and admins change a member's role, and only an admin hands out admin",
		async () => {
			const context = await organization([
				"member",
			]);
			const { as } = context;
			const [target] = context.targets;

			expect(
				(
					await outcomesByRole(
						[
							"member",
							"viewer",
						],
						(role) => update(context, as[role], target, "viewer"),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});

			const demoted = await update(context, as.manager, target, "viewer");
			expect(demoted.data.role).toBe("viewer");

			expect(
				await outcomeOf(update(context, as.manager, target, "admin")),
			).toBe("ForbiddenError");

			const promoted = await update(context, as.admin, target, "admin");
			expect(promoted.data.role).toBe("admin");
		},
		TIMEOUT,
	);

	test(
		"only managers and admins remove members, and only an admin removes an admin",
		async () => {
			const context = await organization([
				"member",
				"admin",
			]);
			const { as } = context;
			const [member, admin] = context.targets;

			expect(
				(
					await outcomesByRole(
						[
							"member",
							"viewer",
						],
						(role) => remove(context, as[role], member),
					)
				).outcomes,
			).toEqual({
				member: "ForbiddenError",
				viewer: "ForbiddenError",
			});

			expect((await remove(context, as.manager, member)).success).toBe(true);
			expect(await outcomeOf(remove(context, as.manager, admin))).toBe(
				"ForbiddenError",
			);
			expect((await remove(context, as.admin, admin)).success).toBe(true);
		},
		TIMEOUT,
	);
});
