import { describe, expect, test } from "bun:test";
import type { OrganizationId, OrganizationInvitationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createUser } from "@orcai/testing";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { inviteMembers } from "@/lib/ai/tools/assistant/people/invite-members";
import { createAssistantTurn } from "@/lib/ai/tools/assistant/turn-state";
import { acceptInvitation } from "@/lib/authz/organization-membership";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, queueBehindOrganizationLock } =
	appIntegration();

const procedures = () => run(Procedures);

const address = (name: string) => `${name}-${crypto.randomUUID()}@example.test`;

const inAWeek = () => new Date(Date.now() + 7 * 86_400_000);

const invitationsOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					id: dbSchema.invitation.id,
					email: dbSchema.invitation.email,
					status: dbSchema.invitation.status,
				})
				.from(dbSchema.invitation)
				.where(eq(dbSchema.invitation.organizationId, organizationId));
		}),
	);

const invitationEmailsTo = (recipients: readonly string[]) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select({
					recipient: dbSchema.notificationOutbox.recipient,
				})
				.from(dbSchema.notificationOutbox)
				.where(
					and(
						eq(dbSchema.notificationOutbox.type, "organization.invited"),
						inArray(
							dbSchema.notificationOutbox.recipient,
							recipients.map((recipient) => recipient.toLowerCase()),
						),
					),
				);
		}),
	);

const expire = (ids: OrganizationInvitationId[]) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db
				.update(dbSchema.invitation)
				.set({
					expiresAt: new Date(Date.now() - 60_000),
				})
				.where(inArray(dbSchema.invitation.id, ids));
		}),
	);

const invite = async (
	actor: Actor,
	zedToken: string | undefined,
	emails: readonly string[],
) => {
	const { organizationInvitation } = await procedures();
	return run(
		organizationInvitation.create(
			{
				role: "member",
				expiresAt: inAWeek(),
				items: emails.map((email) => ({
					email,
				})),
			},
			await procedureOptions(actor, zedToken),
		),
	);
};

describe("inviting", () => {
	test(
		"skips members and addresses with a valid invitation, without an email, and names them",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const invited = address("invited");
			await invite(admin, zedToken, [
				invited,
			]);
			const newcomer = address("newcomer");

			const { data, skipped } = await invite(admin, zedToken, [
				member.user.email.toUpperCase(),
				invited.toUpperCase(),
				newcomer,
			]);

			expect(data.map((invitation) => invitation.email)).toEqual([
				newcomer,
			]);
			expect(skipped).toEqual([
				{
					email: member.user.email.toUpperCase(),
					reason: "member",
				},
				{
					email: invited.toUpperCase(),
					reason: "pending",
				},
			]);
			expect(await invitationsOf(organizationId)).toHaveLength(2);
			expect(
				await invitationEmailsTo([
					member.user.email,
					invited,
					newcomer,
				]),
			).toHaveLength(2);
		},
		TIMEOUT,
	);

	test(
		"replaces an expired invitation with a new one and a new email",
		async () => {
			const {
				organizationId,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const lapsed = address("lapsed");
			const {
				data: [expired],
			} = await invite(admin, zedToken, [
				lapsed,
			]);
			await expire([
				expired.id,
			]);

			const { data, skipped } = await invite(admin, zedToken, [
				lapsed,
			]);

			expect(skipped).toEqual([]);
			expect(await invitationsOf(organizationId)).toEqual(
				expect.arrayContaining([
					{
						id: expired.id,
						email: lapsed,
						status: "rejected",
					},
					{
						id: data[0].id,
						email: lapsed,
						status: "pending",
					},
				]),
			);
			expect(
				await invitationEmailsTo([
					lapsed,
				]),
			).toHaveLength(2);
		},
		TIMEOUT,
	);

	test(
		"concurrent overlapping invites in any case give one invitation and one email per address",
		async () => {
			const {
				organizationId,
				actors: [admin, manager],
				zedToken,
			} = await organizationWith([
				"admin",
				"manager",
			]);
			const emails = [
				address("anna"),
				address("ben"),
				address("cleo"),
			];

			const results = await Promise.all([
				invite(admin, zedToken, emails),
				invite(
					manager,
					zedToken,
					emails.map((email) => email.toUpperCase()).reverse(),
				),
				invite(admin, zedToken, emails.slice(1)),
			]);

			expect(
				results
					.flatMap(({ data }) => data)
					.map(({ email }) => email.toLowerCase()),
			).toEqual(expect.arrayContaining(emails));
			expect(results.flatMap(({ data }) => data)).toHaveLength(emails.length);
			expect(
				results
					.flatMap(({ skipped }) => skipped)
					.every(({ reason }) => reason === "pending"),
			).toBe(true);
			expect(await invitationsOf(organizationId)).toHaveLength(emails.length);
			expect(await invitationEmailsTo(emails)).toHaveLength(emails.length);
		},
		TIMEOUT,
	);

	test(
		"concurrent overlapping invites replace each expired invitation once",
		async () => {
			const {
				organizationId,
				actors: [admin, manager],
				zedToken,
			} = await organizationWith([
				"admin",
				"manager",
			]);
			const emails = [
				address("anna"),
				address("ben"),
				address("cleo"),
				address("dora"),
			];
			const { data: lapsed } = await invite(admin, zedToken, emails);
			await expire(lapsed.map(({ id }) => id));

			const results = await Promise.all([
				invite(admin, zedToken, emails),
				invite(
					manager,
					zedToken,
					emails.map((email) => email.toUpperCase()).reverse(),
				),
				invite(admin, zedToken, emails.slice(1).reverse()),
			]);

			expect(results.flatMap(({ data }) => data)).toHaveLength(emails.length);
			const invitations = await invitationsOf(organizationId);
			expect(
				invitations.filter(({ status }) => status === "pending"),
			).toHaveLength(emails.length);
			expect(
				invitations.filter(({ status }) => status === "rejected"),
			).toHaveLength(emails.length);
			expect(await invitationEmailsTo(emails)).toHaveLength(2 * emails.length);
		},
		TIMEOUT,
	);

	test(
		"an invite queued behind an acceptance skips the new member",
		async () => {
			const {
				organizationId,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const invitee = await run(createUser());
			const {
				data: [invitation],
			} = await invite(admin, zedToken, [
				invitee.email,
			]);
			let queued: Awaited<ReturnType<typeof invite>> | undefined;

			await queueBehindOrganizationLock(
				organizationId,
				() =>
					run(
						acceptInvitation({
							invitationId: invitation.id,
							userId: invitee.id,
							email: invitee.email,
						}),
					),
				async () => {
					queued = await invite(admin, zedToken, [
						invitee.email,
					]);
				},
			);

			expect(queued).toMatchObject({
				data: [],
				skipped: [
					{
						email: invitee.email,
						reason: "member",
					},
				],
			});
			expect(await invitationsOf(organizationId)).toEqual([
				{
					id: invitation.id,
					email: invitee.email,
					status: "accepted",
				},
			]);
			expect(
				await invitationEmailsTo([
					invitee.email,
				]),
			).toHaveLength(1);
		},
		TIMEOUT,
	);

	test(
		"an approved Assistant invite that runs again sends each email once and names the skipped addresses",
		async () => {
			const {
				organizationId,
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const emails = [
				address("anna"),
				address("ben"),
			];
			const { context } = await procedureOptions(admin, zedToken);
			const runInvite = () =>
				run(
					inviteMembers(
						{
							context,
							turn: createAssistantTurn({
								zedToken,
							}),
						},
						{
							emails,
							role: "member",
						},
						new Date(),
					),
				);

			const first = await runInvite();
			const again = await runInvite();

			expect(first.invited.map(({ email }) => email)).toEqual(emails);
			expect(first.skipped).toEqual([]);
			expect(again.invited).toEqual([]);
			expect(again.skipped).toEqual(
				emails.map((email) => ({
					email,
					reason: "pending",
				})),
			);
			expect(await invitationsOf(organizationId)).toHaveLength(2);
			expect(await invitationEmailsTo(emails)).toHaveLength(2);
		},
		TIMEOUT,
	);
});
