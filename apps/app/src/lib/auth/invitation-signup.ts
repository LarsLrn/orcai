import {
	normalizeEmail,
	type OrganizationInvitationId,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, gt, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
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

/** Validate and accept exactly one invitation under the membership lock.
 * A transaction failure leaves it pending; committed permissions are replayable.
 */
export const acceptInvitation = (params: {
	userId: UserId;
	email: string;
	invitationId: OrganizationInvitationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const eventId = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				yield* tx.execute(sql`LOCK TABLE "member" IN SHARE ROW EXCLUSIVE MODE`);
				const [invitation] = yield* tx
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
				if (!invitation)
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							message:
								"A pending, unexpired invitation for this address is required",
						}),
					);
				const [existing] = yield* tx
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
					yield* tx.insert(dbSchema.member).values({
						organizationId: invitation.organizationId,
						userId: params.userId,
						role,
						createdAt: new Date(),
					});
				yield* tx
					.update(dbSchema.invitation)
					.set({
						status: "accepted",
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.invitation.id, invitation.id));
				return yield* enqueueRelationshipMutations({
					tx,
					mutations: [
						{
							resourceType: "organization",
							resourceId: invitation.organizationId,
							relation: role,
							subjectType: "user",
							subjectId: params.userId,
							operation: "touch",
						},
					],
				});
			}),
		);
		return yield* authz.deliverRelationshipEvent(eventId).pipe(
			Effect.catch((cause) =>
				Effect.logError(`authz.delivery_failed cause=${String(cause)}`).pipe(
					Effect.as({
						zedToken: undefined,
					}),
				),
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
