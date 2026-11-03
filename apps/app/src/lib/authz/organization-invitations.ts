import {
	normalizeEmail,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema, retryDeadlocks } from "@orcai/db";
import {
	notificationOutboxValues,
	wakeNotificationWorker,
} from "@orcai/notifications";
import type { Locale, SkippedInvitee } from "@orcai/schema";
import { and, eq, getColumns, inArray, lt, sql } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { lockOrganization } from "@/lib/authz/relationship-write";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";

type InvitationParams = {
	organizationId: OrganizationId;
	emails: readonly string[];
	role: OrganizationRole;
	expiresAt: Date;
	locale: Locale;
	inviter: {
		id: UserId;
		name: string;
	};
};

/** The address a pending invitation holds, as the unique index compares it. */
const invitedAddress = sql<string>`lower(trim(${dbSchema.invitation.email}))`;

/**
 * Inserts the invitations and their emails in the enclosing transaction.
 * Skips members and addresses with a pending invitation that has not expired,
 * and replaces an expired one. Takes the organization's write lock first, so
 * it runs after membership writes in flight. Wake the notification worker
 * after the commit.
 */
export const insertInvitations = (params: InvitationParams) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { config } = yield* AppConfigService;
		const [organization] = yield* db
			.select({
				name: dbSchema.organization.name,
			})
			.from(dbSchema.organization)
			.where(eq(dbSchema.organization.id, params.organizationId));
		if (!organization) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ORGANIZATION_NOT_FOUND",
					message: "Organization not found",
				}),
			);
		}

		yield* db.execute(lockOrganization(params.organizationId));
		const emails = Arr.dedupeWith(
			params.emails.map((email) => email.trim()),
			(a, b) => normalizeEmail(a) === normalizeEmail(b),
		);
		const members = yield* db
			.select({
				email: dbSchema.user.email,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					inArray(
						sql`lower(${dbSchema.user.email})`,
						emails.map(normalizeEmail),
					),
				),
			);
		const memberAddresses = new Set(
			members.map((member) => normalizeEmail(member.email)),
		);
		const invitees = emails.filter(
			(email) => !memberAddresses.has(normalizeEmail(email)),
		);

		const now = new Date();
		const invitations =
			invitees.length === 0
				? []
				: yield* Effect.gen(function* () {
						yield* db
							.update(dbSchema.invitation)
							.set({
								status: "rejected",
								updatedAt: now,
							})
							.where(
								and(
									eq(dbSchema.invitation.organizationId, params.organizationId),
									eq(dbSchema.invitation.status, "pending"),
									lt(dbSchema.invitation.expiresAt, now),
									inArray(invitedAddress, invitees.map(normalizeEmail)),
								),
							);
						return yield* db
							.insert(dbSchema.invitation)
							.values(
								invitees.map((email) => ({
									email,
									organizationId: params.organizationId,
									role: params.role,
									status: "pending" as const,
									expiresAt: params.expiresAt,
									inviterId: params.inviter.id,
								})),
							)
							.onConflictDoNothing()
							.returning({
								...getColumns(dbSchema.invitation),
							});
					});
		if (invitations.length > 0) {
			yield* db.insert(dbSchema.notificationOutbox).values(
				invitations.map((invitation) =>
					notificationOutboxValues(
						{
							type: "organization.invited",
							recipient: invitation.email,
							recipientName: invitation.email.split("@")[0] || undefined,
							invitationId: invitation.id,
							organizationName: organization.name,
							inviterName: params.inviter.name,
							role: invitation.role,
							expiresAt: invitation.expiresAt,
							registrationUrl: `${config.auth.url}/register?inv=${invitation.id}`,
							locale: params.locale,
						},
						`organization.invited:${invitation.id}`,
					),
				),
			);
		}

		const invited = new Set(
			invitations.map((invitation) => normalizeEmail(invitation.email)),
		);
		const skipped = emails
			.filter((email) => !invited.has(normalizeEmail(email)))
			.map(
				(email): SkippedInvitee => ({
					email,
					reason: memberAddresses.has(normalizeEmail(email))
						? "member"
						: "pending",
				}),
			);
		return {
			invitations,
			skipped,
		};
	});

export const wakeInvitationEmails = wakeNotificationWorker.pipe(
	Effect.catch((cause) => Effect.logWarning("notification.wake.failed", cause)),
);

/** Invites `emails` to the organization with `role` and queues their emails, as {@link insertInvitations}. */
export const inviteToOrganization = (params: InvitationParams) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const created = yield* retryDeadlocks(
			db.transaction(() => insertInvitations(params)),
		);
		yield* wakeInvitationEmails;
		return created;
	});
