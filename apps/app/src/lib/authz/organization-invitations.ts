import {
	normalizeEmail,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	notificationOutboxValues,
	wakeNotificationWorker,
} from "@orcai/notifications";
import type { Locale } from "@orcai/schema";
import { and, eq, getColumns, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
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

/**
 * Inserts the invitations and their emails in the enclosing transaction.
 * Fails for an address that already belongs to a member, before anything is
 * written. Wake the notification worker after the commit.
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
						params.emails.map(normalizeEmail),
					),
				),
			);
		if (members.length > 0) {
			const emails = members.map((member) => member.email);
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "INVITEE_ALREADY_MEMBER",
					params: {
						emails,
					},
					message: `Already a member of this organization: ${emails.join(", ")}. Change their role instead.`,
				}),
			);
		}

		const invitations = yield* db
			.insert(dbSchema.invitation)
			.values(
				params.emails.map((email) => ({
					email,
					organizationId: params.organizationId,
					role: params.role,
					status: "pending" as const,
					expiresAt: params.expiresAt,
					inviterId: params.inviter.id,
				})),
			)
			.returning({
				...getColumns(dbSchema.invitation),
			});
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
		return invitations;
	});

export const wakeInvitationEmails = wakeNotificationWorker.pipe(
	Effect.catch((cause) =>
		Effect.logWarning(`notification.wake.failed cause=${String(cause)}`),
	),
);

/** Invites `emails` to the organization with `role` and queues their emails. */
export const inviteToOrganization = (params: InvitationParams) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const created = yield* db.transaction(() => insertInvitations(params));
		yield* wakeInvitationEmails;
		return created;
	});
