import { describe, expect, test } from "bun:test";
import type {
	OrganizationId,
	OrganizationInvitationId,
	OrganizationRole,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createUser } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import {
	acceptInvitation,
	addMember,
	banAccount,
	changeMemberRole,
	deleteAccounts,
	removeMembers,
} from "@/lib/authz/organization-membership";

const {
	run,
	organizationWith,
	outboxDelivered,
	readTuples,
	instanceAdmin,
	createBlock,
} = authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

type Organization = Awaited<ReturnType<typeof organizationWith>>;

const actorOf = (actor: Actor) => ({
	kind: "member" as const,
	userId: actor.user.id,
});

const changeRole =
	(
		organization: Organization,
		actor: Actor,
		target: Actor,
		role: OrganizationRole,
	) =>
	() =>
		run(
			changeMemberRole({
				organizationId: organization.organizationId,
				userId: target.user.id,
				role,
				actor: actorOf(actor),
			}),
		);

const remove =
	(organization: Organization, actor: Actor, target: Actor) => () =>
		run(
			removeMembers({
				organizationId: organization.organizationId,
				userIds: [
					target.user.id,
				],
				actor: actorOf(actor),
			}),
		);

const ban = (target: Actor, actorId: UserId) => () =>
	run(
		banAccount({
			userId: target.user.id,
			reason: undefined,
			actorId,
		}),
	);

/** Each member's role, in both stores, as `role@userId`. */
const rolesOf = async (organizationId: OrganizationId) => {
	await outboxDelivered(organizationId);
	const members = await run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					role: dbSchema.member.role,
					userId: dbSchema.member.userId,
				})
				.from(dbSchema.member)
				.where(eq(dbSchema.member.organizationId, organizationId));
		}),
	);
	return {
		members: members.map((member) => `${member.role}@${member.userId}`).sort(),
		tuples: (
			await readTuples({
				resourceType: "organization",
				resourceId: organizationId,
			})
		).map((tuple) => tuple.replace("user:", "")),
	};
};

const isBanned = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [row] = yield* db
				.select({
					banned: dbSchema.user.banned,
				})
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, actor.user.id));
			return row.banned === true;
		}),
	);

/** Runs `first` then `second` behind the lock and returns the second's error. */
const secondRejected = async (
	organizationId: OrganizationId,
	first: () => Promise<unknown>,
	second: () => Promise<unknown>,
) => {
	let rejected: unknown;
	await queueBehindOrganizationLock(organizationId, first, async () => {
		rejected = await rejection(second());
	});
	return rejected;
};

describe("role change and removal", () => {
	test(
		"removing a member queued after a demotion leaves no role in either store",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [admin, demoted],
			} = organization;
			await queueBehindOrganizationLock(
				organizationId,
				changeRole(organization, admin, demoted, "member"),
				remove(organization, admin, demoted),
			);
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${admin.user.id}`,
				],
				tuples: [
					`admin@${admin.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"of two admins demoting each other, the second is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [first, second],
			} = organization;
			const rejected = await secondRejected(
				organizationId,
				changeRole(organization, first, second, "member"),
				changeRole(organization, second, first, "member"),
			);
			expect(rejected).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${first.user.id}`,
					`member@${second.user.id}`,
				].sort(),
				tuples: [
					`admin@${first.user.id}`,
					`member@${second.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"a removal of an admin queued after the actor became a manager is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [first, second],
			} = organization;
			const rejected = await secondRejected(
				organizationId,
				changeRole(organization, first, second, "manager"),
				remove(organization, second, first),
			);
			expect(rejected).toMatchObject({
				reason: "ORGANIZATION_ADMIN_REQUIRED",
			});
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${first.user.id}`,
					`manager@${second.user.id}`,
				].sort(),
				tuples: [
					`admin@${first.user.id}`,
					`manager@${second.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"of two removals of the last two admins, the second is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [first, second],
			} = organization;
			const rejected = await secondRejected(
				organizationId,
				remove(organization, second, first),
				remove(organization, first, second),
			);
			expect(rejected).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${second.user.id}`,
				],
				tuples: [
					`admin@${second.user.id}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a manager demoted before their tuples arrive takes no member's content",
		async () => {
			const organization = await organizationWith([
				"admin",
				"manager",
				"member",
			]);
			const {
				organizationId,
				zedToken,
				actors: [, demoted, target],
			} = organization;
			const { blockId } = await createBlock(target, zedToken);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.update(dbSchema.member)
						.set({
							role: "member",
						})
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.userId, demoted.user.id),
							),
						);
				}),
			);
			const takeover = {
				organizationId,
				receiverId: demoted.user.id,
				actor: actorOf(demoted),
			};
			expect(
				await rejection(
					run(
						changeMemberRole({
							...takeover,
							userId: target.user.id,
							role: "viewer",
						}),
					),
				),
			).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(
				await rejection(
					run(
						removeMembers({
							...takeover,
							userIds: [
								target.user.id,
							],
						}),
					),
				),
			).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			const [block] = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					return yield* db
						.select({
							userId: dbSchema.block.userId,
						})
						.from(dbSchema.block)
						.where(eq(dbSchema.block.id, blockId));
				}),
			);
			expect(block.userId).toBe(target.user.id);
			expect((await rolesOf(organizationId)).members).toContain(
				`member@${target.user.id}`,
			);
		},
		TIMEOUT,
	);

	test(
		"a manager cannot change an admin's role",
		async () => {
			const organization = await organizationWith([
				"admin",
				"manager",
			]);
			const {
				actors: [admin, manager],
			} = organization;
			expect(
				await rejection(changeRole(organization, manager, admin, "member")()),
			).toMatchObject({
				reason: "ORGANIZATION_ADMIN_REQUIRED",
			});
		},
		TIMEOUT,
	);
});

describe("account ban and deletion", () => {
	test(
		"banning the last admin who can sign in is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"member",
			]);
			const {
				organizationId,
				actors: [admin],
			} = organization;
			const instance = await instanceAdmin(organizationId);
			expect(await rejection(ban(admin, instance.user.id)())).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
			expect(await isBanned(admin)).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"a banned admin does not count towards the floor",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [banned, remaining],
			} = organization;
			const instance = await instanceAdmin(organizationId);
			await ban(banned, instance.user.id)();
			expect(await isBanned(banned)).toBe(true);
			expect(
				await rejection(
					changeRole(organization, remaining, remaining, "member")(),
				),
			).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
		},
		TIMEOUT,
	);

	test(
		"a ban queued after a demotion of the other admin is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"admin",
			]);
			const {
				organizationId,
				actors: [first, second],
			} = organization;
			const instance = await instanceAdmin(organizationId);
			const rejected = await secondRejected(
				organizationId,
				changeRole(organization, first, second, "member"),
				ban(first, instance.user.id),
			);
			expect(rejected).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
			expect(await isBanned(first)).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"deleting the last admin's account is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
				"member",
			]);
			const {
				organizationId,
				actors: [admin],
			} = organization;
			const instance = await instanceAdmin(organizationId);
			expect(
				await rejection(
					run(
						deleteAccounts({
							userIds: [
								admin.user.id,
							],
							actorId: instance.user.id,
						}),
					),
				),
			).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
			expect((await rolesOf(organizationId)).members).toContain(
				`admin@${admin.user.id}`,
			);
		},
		TIMEOUT,
	);
});

/** A pending invitation from the organization's first actor. */
const invite = (
	organization: Organization,
	params: {
		email: string;
		role: OrganizationRole;
		expiresAt?: Date;
	},
) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [invitation] = yield* db
				.insert(dbSchema.invitation)
				.values({
					organizationId: organization.organizationId,
					email: params.email,
					role: params.role,
					status: "pending",
					expiresAt: params.expiresAt ?? new Date(Date.now() + 3_600_000),
					inviterId: organization.actors[0].user.id,
				})
				.returning();
			return invitation;
		}),
	);

const accept =
	(
		invitationId: OrganizationInvitationId,
		user: {
			id: UserId;
			email: string;
		},
	) =>
	() =>
		run(
			acceptInvitation({
				invitationId,
				userId: user.id,
				email: user.email,
			}),
		);

const statusOf = (invitationId: OrganizationInvitationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [row] = yield* db
				.select({
					status: dbSchema.invitation.status,
				})
				.from(dbSchema.invitation)
				.where(eq(dbSchema.invitation.id, invitationId));
			return row.status;
		}),
	);

describe("invitation acceptance", () => {
	test(
		"accepting adds the invitee with the invitation's role in both stores",
		async () => {
			const organization = await organizationWith([
				"admin",
			]);
			const {
				organizationId,
				actors: [admin],
			} = organization;
			const invitee = await run(createUser());
			const invitation = await invite(organization, {
				email: ` ${invitee.email.toUpperCase()} `,
				role: "manager",
			});
			const { zedToken } = await accept(invitation.id, invitee)();
			expect(zedToken).toBeString();
			expect(await statusOf(invitation.id)).toBe("accepted");
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${admin.user.id}`,
					`manager@${invitee.id}`,
				].sort(),
				tuples: [
					`admin@${admin.user.id}`,
					`manager@${invitee.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"of two acceptances of one invitation, the second is rejected",
		async () => {
			const organization = await organizationWith([
				"admin",
			]);
			const {
				organizationId,
				actors: [admin],
			} = organization;
			const invitee = await run(createUser());
			const invitation = await invite(organization, {
				email: invitee.email,
				role: "member",
			});
			const rejected = await secondRejected(
				organizationId,
				accept(invitation.id, invitee),
				accept(invitation.id, invitee),
			);
			expect(rejected).toMatchObject({
				reason: "INVITATION_REQUIRED",
			});
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${admin.user.id}`,
					`member@${invitee.id}`,
				].sort(),
				tuples: [
					`admin@${admin.user.id}`,
					`member@${invitee.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"a member who accepts keeps their role",
		async () => {
			const organization = await organizationWith([
				"admin",
				"manager",
			]);
			const {
				organizationId,
				actors: [admin, manager],
			} = organization;
			const invitation = await invite(organization, {
				email: manager.user.email,
				role: "member",
			});
			await accept(invitation.id, manager.user)();
			expect(await statusOf(invitation.id)).toBe("accepted");
			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${admin.user.id}`,
					`manager@${manager.user.id}`,
				].sort(),
				tuples: [
					`admin@${admin.user.id}`,
					`manager@${manager.user.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"another address or an expired invitation is rejected and stays pending",
		async () => {
			const organization = await organizationWith([
				"admin",
			]);
			const {
				organizationId,
				actors: [admin],
			} = organization;
			const invitee = await run(createUser());
			const stranger = await run(createUser());
			const invitation = await invite(organization, {
				email: invitee.email,
				role: "member",
			});
			const expired = await invite(organization, {
				email: invitee.email,
				role: "member",
				expiresAt: new Date(Date.now() - 60_000),
			});
			expect(await rejection(accept(invitation.id, stranger)())).toMatchObject({
				reason: "INVITATION_RESPONSE_FORBIDDEN",
			});
			expect(await rejection(accept(expired.id, invitee)())).toMatchObject({
				reason: "INVITATION_EXPIRED",
			});
			expect(await statusOf(invitation.id)).toBe("pending");
			expect(await statusOf(expired.id)).toBe("pending");
			expect((await rolesOf(organizationId)).members).toEqual([
				`admin@${admin.user.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("instance admin actions", () => {
	const asInstanceAdmin = (actor: Actor) => ({
		kind: "instance-admin" as const,
		userId: actor.user.id,
	});

	test(
		"an instance admin outside the organization adds, changes and removes members",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
			} = await organizationWith([
				"admin",
				"member",
			]);
			const instance = asInstanceAdmin(await instanceAdmin(organizationId));
			const joining = await run(createUser());

			await run(
				addMember({
					organizationId,
					userId: joining.id,
					role: "manager",
					actor: instance,
				}),
			);
			await run(
				changeMemberRole({
					organizationId,
					userId: member.user.id,
					role: "admin",
					actor: instance,
				}),
			);
			await run(
				removeMembers({
					organizationId,
					userIds: [
						admin.user.id,
					],
					actor: instance,
				}),
			);

			expect(await rolesOf(organizationId)).toEqual({
				members: [
					`admin@${member.user.id}`,
					`manager@${joining.id}`,
				].sort(),
				tuples: [
					`admin@${member.user.id}`,
					`manager@${joining.id}`,
				].sort(),
			});
		},
		TIMEOUT,
	);

	test(
		"keeps the last admin and refuses existing members and banned accounts",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
			} = await organizationWith([
				"admin",
				"member",
			]);
			const instanceActor = await instanceAdmin(organizationId);
			const instance = asInstanceAdmin(instanceActor);

			expect(
				await rejection(
					run(
						changeMemberRole({
							organizationId,
							userId: admin.user.id,
							role: "member",
							actor: instance,
						}),
					),
				),
			).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
			expect(
				await rejection(
					run(
						removeMembers({
							organizationId,
							userIds: [
								admin.user.id,
							],
							actor: instance,
						}),
					),
				),
			).toMatchObject({
				reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
			});
			expect(
				await rejection(
					run(
						addMember({
							organizationId,
							userId: member.user.id,
							role: "admin",
							actor: instance,
						}),
					),
				),
			).toMatchObject({
				reason: "ALREADY_EXISTS",
			});

			const banned = await run(createUser());
			await run(
				banAccount({
					userId: banned.id,
					reason: undefined,
					actorId: instanceActor.user.id,
				}),
			);
			expect(
				await rejection(
					run(
						addMember({
							organizationId,
							userId: banned.id,
							role: "member",
							actor: instance,
						}),
					),
				),
			).toMatchObject({
				reason: "USER_BANNED",
			});
		},
		TIMEOUT,
	);

	test(
		"refuses an instance admin whose role was revoked",
		async () => {
			const {
				organizationId,
				actors: [, member],
			} = await organizationWith([
				"admin",
				"member",
			]);
			const revoked = await instanceAdmin(organizationId);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db
						.update(dbSchema.user)
						.set({
							role: "user",
						})
						.where(eq(dbSchema.user.id, revoked.user.id));
				}),
			);

			expect(
				await rejection(
					run(
						changeMemberRole({
							organizationId,
							userId: member.user.id,
							role: "manager",
							actor: asInstanceAdmin(revoked),
						}),
					),
				),
			).toMatchObject({
				reason: "INSTANCE_ADMIN_REQUIRED",
			});
		},
		TIMEOUT,
	);
});
