import {
	normalizeEmail,
	type OrganizationInvitationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, gt, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

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

/** Validate and accept exactly one invitation under its organization's write lock. */
export const acceptInvitation = (params: {
	userId: UserId;
	email: string;
	invitationId: OrganizationInvitationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const invitationRequired = new AppErrors.BadRequestError({
			reason: "INVITATION_REQUIRED",
			message: "A pending, unexpired invitation for this address is required",
		});
		const [target] = yield* db
			.select({
				organizationId: dbSchema.invitation.organizationId,
			})
			.from(dbSchema.invitation)
			.where(eq(dbSchema.invitation.id, params.invitationId));
		if (!target) return yield* Effect.fail(invitationRequired);

		const { zedToken } = yield* writeRelationships(
			{
				organizationIds: [
					target.organizationId,
				],
			},
			Effect.gen(function* () {
				const [invitation] = yield* db
					.select()
					.from(dbSchema.invitation)
					.where(
						and(
							eq(dbSchema.invitation.id, params.invitationId),
							invitationAddressedTo(params.email),
							eq(dbSchema.invitation.status, "pending"),
							gt(dbSchema.invitation.expiresAt, new Date()),
						),
					)
					.for("update");
				if (!invitation) return yield* Effect.fail(invitationRequired);
				const [existing] = yield* db
					.select()
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, invitation.organizationId),
							eq(dbSchema.member.userId, params.userId),
						),
					);
				const role = existing?.role ?? invitation.role ?? "member";
				if (!existing)
					yield* db.insert(dbSchema.member).values({
						organizationId: invitation.organizationId,
						userId: params.userId,
						role,
						createdAt: new Date(),
					});
				yield* db
					.update(dbSchema.invitation)
					.set({
						status: "accepted",
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.invitation.id, invitation.id));
				yield* recordRelationshipFacts(
					RelationshipFact.OrganizationRoleChanged({
						organizationId: invitation.organizationId,
						userId: params.userId,
						from: existing?.role ?? null,
						to: role,
					}),
				);
			}),
		);
		return {
			zedToken,
		};
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
