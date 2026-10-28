import { describe, expect, test } from "bun:test";
import type { OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createUser } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import {
	banAccount,
	deleteAccounts,
} from "@/lib/authz/organization-membership";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const procedures = () => run(Procedures);

const membersOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					userId: dbSchema.member.userId,
					role: dbSchema.member.role,
				})
				.from(dbSchema.member)
				.where(eq(dbSchema.member.organizationId, organizationId));
		}),
	);

const invitationsOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					id: dbSchema.invitation.id,
					email: dbSchema.invitation.email,
					role: dbSchema.invitation.role,
					status: dbSchema.invitation.status,
				})
				.from(dbSchema.invitation)
				.where(eq(dbSchema.invitation.organizationId, organizationId));
		}),
	);

const invitationEmailsTo = (recipient: string) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					id: dbSchema.notificationOutbox.id,
				})
				.from(dbSchema.notificationOutbox)
				.where(
					and(
						eq(dbSchema.notificationOutbox.type, "organization.invited"),
						eq(dbSchema.notificationOutbox.recipient, recipient.toLowerCase()),
					),
				);
		}),
	);

const createOrganization = async (
	actor: Actor,
	initialAdmin:
		| {
				kind: "user";
				userId: UserId;
		  }
		| {
				kind: "invite";
				email: string;
		  },
) => {
	const suffix = crypto.randomUUID();
	return (await procedures()).organization.create(
		{
			name: `Instance ${suffix}`,
			slug: `instance-${suffix}`,
			initialAdmin,
		},
		await procedureOptions(actor),
	);
};

describe("instance procedures", () => {
	test(
		"are for instance admins only",
		async () => {
			const {
				organizationId,
				actors: [admin],
			} = await organizationWith([
				"admin",
			]);
			const { instance } = await procedures();
			const options = await procedureOptions(admin);

			const forbidden = {
				_tag: "ForbiddenError",
			};
			expect(
				await rejection(
					run(
						instance.organization(
							{
								id: organizationId,
							},
							options,
						),
					),
				),
			).toMatchObject(forbidden);
			expect(
				await rejection(
					run(
						instance.user(
							{
								id: admin.user.id,
							},
							options,
						),
					),
				),
			).toMatchObject(forbidden);
			expect(
				await rejection(
					run(
						instance.changeMemberRole(
							{
								organizationId,
								userId: admin.user.id,
								role: "member",
							},
							options,
						),
					),
				),
			).toMatchObject(forbidden);
		},
		TIMEOUT,
	);

	test(
		"list an organisation's members and an account's organisations, paged and searched",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
			} = await organizationWith([
				"admin",
				"member",
			]);
			const instanceActor = await instanceAdmin(organizationId);
			const { instance } = await procedures();
			const options = await procedureOptions(instanceActor);

			const members = await run(
				instance.organizationMembers(
					{
						organizationId,
						pageIndex: 0,
						pageSize: 1,
						sort: [
							{
								id: "role",
								desc: false,
							},
						],
					},
					options,
				),
			);
			expect(members.rowCount).toBe(2);
			expect(members.data).toHaveLength(1);

			const searched = await run(
				instance.organizationMembers(
					{
						organizationId,
						pageIndex: 0,
						pageSize: 20,
						query: member.user.email,
					},
					options,
				),
			);
			expect(searched.data.map((row) => row.userId)).toEqual([
				member.user.id,
			]);

			const memberships = await run(
				instance.userMemberships(
					{
						userId: admin.user.id,
						pageIndex: 0,
						pageSize: 20,
					},
					options,
				),
			);
			expect(memberships.data).toMatchObject([
				{
					organizationId,
					role: "admin",
				},
			]);
			const { data: user } = await run(
				instance.user(
					{
						id: admin.user.id,
					},
					options,
				),
			);
			expect(user.membershipCount).toBe(1);
		},
		TIMEOUT,
	);

	test(
		"refuse to invite someone who is already a member, before any email",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const instanceActor = await instanceAdmin(organizationId);
			const { instance, organizationInvitation } = await procedures();

			expect(
				await rejection(
					run(
						instance.inviteMember(
							{
								organizationId,
								email: member.user.email.toUpperCase(),
								role: "admin",
							},
							await procedureOptions(instanceActor),
						),
					),
				),
			).toMatchObject({
				reason: "INVITEE_ALREADY_MEMBER",
			});
			expect(
				await rejection(
					run(
						organizationInvitation.create(
							{
								role: "member",
								expiresAt: new Date(Date.now() + 86_400_000),
								items: [
									{
										email: member.user.email,
									},
								],
							},
							await procedureOptions(admin, zedToken),
						),
					),
				),
			).toMatchObject({
				reason: "INVITEE_ALREADY_MEMBER",
			});
			expect(await invitationsOf(organizationId)).toEqual([]);
			expect(await invitationEmailsTo(member.user.email)).toEqual([]);

			const newcomer = `newcomer-${crypto.randomUUID()}@example.test`;
			await run(
				instance.inviteMember(
					{
						organizationId,
						email: newcomer,
						role: "manager",
					},
					await procedureOptions(instanceActor),
				),
			);
			expect(await invitationsOf(organizationId)).toMatchObject([
				{
					email: newcomer,
					role: "manager",
					status: "pending",
				},
			]);
			expect(await invitationEmailsTo(newcomer)).toHaveLength(1);
		},
		TIMEOUT,
	);
});

describe("instance readiness", () => {
	test(
		"reads the organisation in the input, not the viewer's active one",
		async () => {
			const {
				organizationId: active,
				actors: [activeAdmin],
			} = await organizationWith([
				"admin",
			]);
			const { organizationId: viewed } = await organizationWith([
				"admin",
			]);
			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					yield* db.insert(dbSchema.provider).values({
						organizationId: viewed,
						name: `Readiness ${crypto.randomUUID()}`,
						kind: "openai-compatible",
						description: "",
						apiKeyEncrypted: "unused",
					});
				}),
			);
			const { instance } = await procedures();
			const providerStatus = async (organizationId: OrganizationId) =>
				(
					await run(
						instance.organizationReadiness(
							{
								organizationId,
							},
							await procedureOptions(await instanceAdmin(active)),
						),
					)
				).data.checks.find((check) => check.id === "provider")?.status;

			expect(await providerStatus(viewed)).toBe("ok");
			expect(await providerStatus(active)).toBe("failing");
			expect(
				await rejection(
					run(
						instance.organizationReadiness(
							{
								organizationId: active,
							},
							await procedureOptions(activeAdmin),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
		},
		TIMEOUT,
	);
});

describe("organisation creation with an initial admin", () => {
	test(
		"makes an existing account the admin without adding the creator",
		async () => {
			const { organizationId } = await organizationWith([
				"admin",
			]);
			const creator = await instanceAdmin(organizationId);
			const target = await run(createUser());

			const { data } = await run(
				await createOrganization(creator, {
					kind: "user",
					userId: target.id,
				}),
			);
			expect(await membersOf(data.id)).toEqual([
				{
					userId: target.id,
					role: "admin",
				},
			]);
		},
		TIMEOUT,
	);

	test(
		"keeps the creator as admin and invites the admin in one step",
		async () => {
			const { organizationId } = await organizationWith([
				"admin",
			]);
			const creator = await instanceAdmin(organizationId);
			const email = `admin-${crypto.randomUUID()}@example.test`;

			const { data } = await run(
				await createOrganization(creator, {
					kind: "invite",
					email,
				}),
			);
			expect(await membersOf(data.id)).toEqual([
				{
					userId: creator.user.id,
					role: "admin",
				},
			]);
			expect(await invitationsOf(data.id)).toMatchObject([
				{
					email,
					role: "admin",
					status: "pending",
				},
			]);
			expect(await invitationEmailsTo(email)).toHaveLength(1);
		},
		TIMEOUT,
	);

	test(
		"refuses a banned account and stays consistent with a concurrent ban or deletion",
		async () => {
			const { organizationId } = await organizationWith([
				"admin",
			]);
			const creator = await instanceAdmin(organizationId);
			const banned = await run(createUser());
			await run(
				banAccount({
					userId: banned.id,
					reason: undefined,
					actorId: creator.user.id,
				}),
			);
			expect(
				await rejection(
					run(
						await createOrganization(creator, {
							kind: "user",
							userId: banned.id,
						}),
					),
				),
			).toMatchObject({
				reason: "USER_BANNED",
			});

			for (const remove of [
				(userId: UserId) =>
					banAccount({
						userId,
						reason: undefined,
						actorId: creator.user.id,
					}),
				(userId: UserId) =>
					deleteAccounts({
						userIds: [
							userId,
						],
						actorId: creator.user.id,
					}),
			]) {
				const target = await run(createUser());
				const [created, removed] = await Promise.allSettled([
					createOrganization(creator, {
						kind: "user",
						userId: target.id,
					}).then(run),
					run(remove(target.id)),
				]);
				// One wins; an organisation never ends up with a banned or deleted sole admin.
				expect(
					[
						created.status,
						removed.status,
					].filter((status) => status === "fulfilled"),
				).toHaveLength(1);
				if (created.status === "fulfilled") {
					expect(await membersOf(created.value.data.id)).toEqual([
						{
							userId: target.id,
							role: "admin",
						},
					]);
				}
			}
		},
		TIMEOUT,
	);
});
