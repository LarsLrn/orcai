import { normalizeEmail, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, gt, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** Invitations sent to this address, compared case-insensitively. */
export const invitationAddressedTo = (email: string) =>
	sql`lower(${dbSchema.invitation.email}) = ${normalizeEmail(email)}`;

/** Every pending, unexpired invitation for an address. */
export const pendingInvitationsFor = (email: string) =>
	Effect.gen(function* () {
		const db = yield* DB;

		return yield* db
			.select({
				id: dbSchema.invitation.id,
				organizationId: dbSchema.invitation.organizationId,
				role: dbSchema.invitation.role,
			})
			.from(dbSchema.invitation)
			.where(
				and(
					invitationAddressedTo(email),
					eq(dbSchema.invitation.status, "pending"),
					gt(dbSchema.invitation.expiresAt, new Date()),
				),
			);
	});

/** The single organisation a user belongs to, or null when it is not one. */
export const soleOrganizationOf = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const memberships = yield* db
			.select({
				organizationId: dbSchema.member.organizationId,
			})
			.from(dbSchema.member)
			.where(eq(dbSchema.member.userId, userId))
			.limit(2);

		return memberships.length === 1 ? memberships[0].organizationId : null;
	});

/** Point a user's sessions without an active organisation at its only one. */
export const activateSoleOrganizationForSessions = (userId: UserId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const organizationId = yield* soleOrganizationOf(userId);

		if (!organizationId) {
			return;
		}

		yield* db
			.update(dbSchema.session)
			.set({
				activeOrganizationId: organizationId,
			})
			.where(
				and(
					eq(dbSchema.session.userId, userId),
					sql`${dbSchema.session.activeOrganizationId} is null`,
				),
			);
	});
