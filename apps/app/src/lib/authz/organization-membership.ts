import {
	ORGANIZATION_ADMIN_ROLE,
	type OrganizationId,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { checkEntityPermission } from "@orcai/spice-db";
import { and, eq, getColumns, inArray, isNull, lt, or } from "drizzle-orm";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { SqlError } from "effect/unstable/sql/SqlError";
import { auth } from "@/lib/auth/auth";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	accountAccessOrganizations,
	detachAccounts,
	detachMembers,
} from "@/lib/authz/resource-access";
import * as AppErrors from "@/lib/effect/utils/errors";

type Actor = {
	userId: UserId;
	zedToken: string | undefined;
};

export const organizationRoleRequiresAdminControl = (
	role: OrganizationRole | null | undefined,
) => role === ORGANIZATION_ADMIN_ROLE;

const canManageOrganizationAdmins = (
	organizationId: OrganizationId,
	actor: Actor,
) =>
	checkEntityPermission({
		entityType: "organization",
		entityId: organizationId,
		permission: "manage_organization",
		userId: actor.userId,
		zedToken: actor.zedToken,
	});

const adminControlRequired = () =>
	new AppErrors.ForbiddenError({
		reason: "ORGANIZATION_ADMIN_REQUIRED",
		message: "Managing organization admins requires admin access.",
		data: {
			entityType: "organization",
			permission: "manage_organization",
		},
	});

export const assertCanManageOrganizationAdmins = (
	organizationId: OrganizationId,
	actor: Actor,
) =>
	canManageOrganizationAdmins(organizationId, actor).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() => adminControlRequired(),
		),
	);

/**
 * Fails when `leaving` takes the organization's last admin who can sign in.
 * Banned admins do not count, so an organization keeps one who can manage it.
 */
const ensureAdminRemains = (params: {
	organizationId: OrganizationId;
	leaving: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const admins = yield* db
			.select({
				userId: dbSchema.member.userId,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
					or(
						isNull(dbSchema.user.banned),
						eq(dbSchema.user.banned, false),
						lt(dbSchema.user.banExpires, new Date()),
					),
				),
			);
		const remaining = admins.filter(
			(admin) => !params.leaving.includes(admin.userId),
		);
		if (admins.length > 0 && remaining.length === 0)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "LAST_ORGANIZATION_ADMIN_REQUIRED",
					message: "At least one organization admin must remain.",
				}),
			);
	});

const memberNotFound = (userId: UserId) =>
	new AppErrors.NotFoundError({
		reason: "MEMBER_NOT_FOUND",
		id: userId,
		message: "Member not found",
	});

/** Changes a member's role. Only admins touch the admin role, and one admin remains. */
export const changeMemberRole = (params: {
	organizationId: OrganizationId;
	userId: UserId;
	role: OrganizationRole | undefined;
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const managesAdmins = yield* canManageOrganizationAdmins(
			params.organizationId,
			params.actor,
		);

		const { result } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				const [existing] = yield* db
					.select({
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							eq(dbSchema.member.userId, params.userId),
						),
					);
				if (!existing) return yield* Effect.fail(memberNotFound(params.userId));

				const role = params.role ?? existing.role;
				if (
					!managesAdmins &&
					(organizationRoleRequiresAdminControl(existing.role) ||
						organizationRoleRequiresAdminControl(role))
				)
					return yield* Effect.fail(adminControlRequired());

				if (
					organizationRoleRequiresAdminControl(existing.role) &&
					!organizationRoleRequiresAdminControl(role)
				)
					yield* ensureAdminRemains({
						organizationId: params.organizationId,
						leaving: [
							params.userId,
						],
					});

				const [member] = yield* db
					.update(dbSchema.member)
					.set({
						role,
					})
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							eq(dbSchema.member.userId, params.userId),
						),
					)
					.returning({
						...getColumns(dbSchema.member),
					});

				yield* recordRelationshipFacts(
					RelationshipFact.OrganizationRoleChanged({
						organizationId: params.organizationId,
						userId: params.userId,
						from: existing.role,
						to: role,
					}),
				);

				return member;
			}),
		);
		return result;
	});

/**
 * Removes members from the organization and detaches their access there. Only
 * admins remove admins, and one admin remains.
 */
export const removeMembers = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	actor: Actor;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const managesAdmins = yield* canManageOrganizationAdmins(
			params.organizationId,
			params.actor,
		);

		yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				const members = yield* db
					.select({
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							inArray(dbSchema.member.userId, [
								...params.userIds,
							]),
						),
					);
				if (members.length === 0) return;
				const userIds = members.map((member) => member.userId);

				if (
					members.some((member) =>
						organizationRoleRequiresAdminControl(member.role),
					)
				) {
					if (!managesAdmins) return yield* Effect.fail(adminControlRequired());
					yield* ensureAdminRemains({
						organizationId: params.organizationId,
						leaving: userIds,
					});
				}

				yield* db
					.delete(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							inArray(dbSchema.member.userId, userIds),
						),
					);
				yield* db
					.update(dbSchema.session)
					.set({
						activeOrganizationId: null,
					})
					.where(
						and(
							inArray(dbSchema.session.userId, userIds),
							eq(dbSchema.session.activeOrganizationId, params.organizationId),
						),
					);

				yield* recordRelationshipFacts(
					...members.map((member) =>
						RelationshipFact.OrganizationRoleChanged({
							organizationId: params.organizationId,
							userId: member.userId,
							from: member.role,
							to: null,
						}),
					),
				);
				yield* detachMembers({
					organizationId: params.organizationId,
					userIds,
					now,
				});
			}),
		);
	});

/** The organizations the users are members of. */
const membershipOrganizations = (userIds: readonly UserId[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.selectDistinct({
				organizationId: dbSchema.member.organizationId,
			})
			.from(dbSchema.member)
			.where(
				inArray(dbSchema.member.userId, [
					...userIds,
				]),
			);
		return rows.map((row) => row.organizationId);
	});

const isConstraintViolation = (error: unknown) =>
	error instanceof EffectDrizzleQueryError &&
	Cause.isCause(error.cause) &&
	(() => {
		const failure = Cause.squash(error.cause);
		return (
			failure instanceof SqlError && failure.reason._tag === "ConstraintError"
		);
	})();

/**
 * Deletes accounts with their memberships, sessions and access. Every
 * organization they belong to keeps an admin.
 */
export const deleteAccounts = (params: {
	userIds: readonly UserId[];
	actorId: UserId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const userIds = [
			...new Set(params.userIds),
		];

		if (userIds.length !== params.userIds.length)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "ITEMS_NOT_UNIQUE",
					message: "Selected users must be unique",
				}),
			);
		if (userIds.includes(params.actorId))
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "SELF_DELETE_FORBIDDEN",
					message: "You cannot delete your own account.",
				}),
			);

		yield* writeRelationships(
			{
				organizationIds: Effect.map(
					Effect.all([
						membershipOrganizations(userIds),
						accountAccessOrganizations(userIds),
					]),
					(lists) => lists.flat(),
				),
			},
			Effect.gen(function* () {
				const existingUsers = yield* db
					.select({
						id: dbSchema.user.id,
					})
					.from(dbSchema.user)
					.where(inArray(dbSchema.user.id, userIds));
				if (existingUsers.length !== userIds.length)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "USER_NOT_FOUND",
							message: "One or more selected users do not exist.",
						}),
					);

				const memberships = yield* db
					.select({
						organizationId: dbSchema.member.organizationId,
						userId: dbSchema.member.userId,
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(inArray(dbSchema.member.userId, userIds));
				for (const organizationId of new Set(
					memberships
						.filter((membership) =>
							organizationRoleRequiresAdminControl(membership.role),
						)
						.map((membership) => membership.organizationId),
				))
					yield* ensureAdminRemains({
						organizationId,
						leaving: userIds,
					});

				yield* db
					.delete(dbSchema.member)
					.where(inArray(dbSchema.member.userId, userIds));
				yield* recordRelationshipFacts(
					...memberships.map((membership) =>
						RelationshipFact.OrganizationRoleChanged({
							organizationId: membership.organizationId,
							userId: membership.userId,
							from: membership.role,
							to: null,
						}),
					),
				);
				yield* detachAccounts({
					userIds,
					now,
				});

				yield* db
					.delete(dbSchema.session)
					.where(inArray(dbSchema.session.userId, userIds));
				yield* db
					.delete(dbSchema.account)
					.where(inArray(dbSchema.account.userId, userIds));
				yield* db
					.delete(dbSchema.user)
					.where(inArray(dbSchema.user.id, userIds))
					.pipe(
						Effect.catchIf(isConstraintViolation, (cause) =>
							Effect.fail(
								new AppErrors.ConflictError({
									reason: "USER_OWNS_CONTENT",
									message:
										"This account still owns groups, resources, grants or invitations, so it cannot be deleted yet. Hand that content over first.",
									cause,
								}),
							),
						),
					);
			}),
		);

		return userIds.length;
	});

/**
 * Bans an account and ends its sessions. Every organization it administers
 * keeps another admin who can sign in.
 */
export const banAccount = (params: {
	userId: UserId;
	reason: string | undefined;
	actorId: UserId;
}) =>
	Effect.gen(function* () {
		if (params.userId === params.actorId)
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "SELF_BAN_FORBIDDEN",
					message: "You cannot ban your own account.",
				}),
			);

		const db = yield* DB;
		yield* writeRelationships(
			{
				organizationIds: membershipOrganizations([
					params.userId,
				]),
			},
			Effect.gen(function* () {
				const administered = yield* db
					.select({
						organizationId: dbSchema.member.organizationId,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.userId, params.userId),
							eq(dbSchema.member.role, ORGANIZATION_ADMIN_ROLE),
						),
					);
				for (const { organizationId } of administered)
					yield* ensureAdminRemains({
						organizationId,
						leaving: [
							params.userId,
						],
					});

				// Written while the locks are held, so a later floor check sees the ban.
				yield* Effect.tryPromise({
					try: async () => {
						const { internalAdapter } = await auth.$context;
						const user = await internalAdapter.updateUser(params.userId, {
							banned: true,
							banReason: params.reason ?? null,
							banExpires: null,
							updatedAt: new Date(),
						});
						if (!user) return false;
						await internalAdapter.deleteUserSessions(params.userId);
						return true;
					},
					catch: (error) =>
						new AppErrors.BadRequestError({
							reason: "USER_BAN_FAILED",
							message:
								error instanceof Error
									? error.message
									: "Failed to ban the user.",
							cause: error,
						}),
				}).pipe(
					Effect.filterOrFail(
						(banned) => banned,
						() =>
							new AppErrors.NotFoundError({
								reason: "USER_NOT_FOUND",
								id: params.userId,
								message: "User not found",
							}),
					),
				);
			}),
		);
	});
