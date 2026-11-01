import {
	normalizeEmail,
	ORGANIZATION_ADMIN_ROLE,
	ORGANIZATION_ROLE_PERMISSIONS,
	type OrganizationId,
	type OrganizationInvitationId,
	type OrganizationPermission,
	type OrganizationRole,
	type UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { checkEntityPermission } from "@orcai/spice-db";
import { and, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { notBanned } from "@/lib/authz/eligible-owner";
import { lockAsInstanceAdmin } from "@/lib/authz/instance-admin-lock";
import {
	handOverAccountsContent,
	handOverOwnedContent,
	ownedContentOrganizations,
} from "@/lib/authz/ownership";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import {
	accountAccessOrganizations,
	detachAccounts,
	detachMembers,
	issuedGrantOrganizations,
} from "@/lib/authz/resource-access";
import {
	deleteResources,
	removeDeletedResourceData,
} from "@/lib/authz/resource-lifecycle";
import { deleteChatsWhere } from "@/lib/chats/chat-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";
import { deleteImages } from "@/lib/images/images";

type Actor = {
	userId: UserId;
	zedToken: string | undefined;
};

/**
 * Who changes memberships: a member, through their organization role, or an
 * instance admin, who need not belong to the organization. Both are checked
 * inside the write.
 */
export type MembershipActor =
	| {
			kind: "member";
			userId: UserId;
	  }
	| {
			kind: "instance-admin";
			userId: UserId;
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

const grants = (role: OrganizationRole, permission: OrganizationPermission) =>
	(
		ORGANIZATION_ROLE_PERMISSIONS[role] as readonly OrganizationPermission[]
	).includes(permission);

/**
 * Under the organization lock: fails unless the actor still manages members
 * by their committed role, so a demotion counts before its tuples arrive, and
 * answers whether they may touch admin memberships. An instance admin always
 * may; their account and the targets' accounts are locked.
 */
const confirmAuthority = (params: {
	organizationId: OrganizationId;
	actor: MembershipActor;
	userIds: readonly UserId[];
}) =>
	Effect.gen(function* () {
		if (params.actor.kind === "instance-admin") {
			yield* lockAsInstanceAdmin({
				actorId: params.actor.userId,
				userIds: params.userIds,
			});
			return {
				managesAdmins: true,
			};
		}
		const db = yield* DB;
		const [membership] = yield* db
			.select({
				role: dbSchema.member.role,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, params.organizationId),
					eq(dbSchema.member.userId, params.actor.userId),
					notBanned(),
				),
			);
		if (!membership || !grants(membership.role, "manage_members"))
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "PERMISSION_DENIED",
					message: "Managing members requires the manage_members permission.",
					data: {
						entityType: "organization",
						permission: "manage_members",
					},
				}),
			);
		return {
			managesAdmins: grants(membership.role, "manage_organization"),
		};
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
					notBanned(),
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

/**
 * Changes a member's role. Only admins touch the admin role, and one admin
 * remains. A member made a Viewer first hands their content to `receiverId`,
 * or by default to the actor.
 */
export const changeMemberRole = (params: {
	organizationId: OrganizationId;
	userId: UserId;
	role: OrganizationRole | undefined;
	receiverId?: UserId;
	actor: MembershipActor;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { result } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				const { managesAdmins } = yield* confirmAuthority({
					organizationId: params.organizationId,
					actor: params.actor,
					userIds: [
						params.userId,
					],
				});
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

				const handedOver =
					role === "viewer" && existing.role !== "viewer"
						? yield* handOverOwnedContent({
								organizationId: params.organizationId,
								fromUserIds: [
									params.userId,
								],
								receiverId: params.receiverId,
								receiverDefault: {
									kind: "actor",
									actorId: params.actor.userId,
								},
							})
						: undefined;

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

				return {
					member,
					handedOver,
				};
			}),
		);
		return result;
	});

/**
 * Removes members from the organization and detaches their access there. Only
 * admins remove admins, and one admin remains. What they own there goes first
 * to `receiverId`, or by default to the actor.
 */
export const removeMembers = (params: {
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	receiverId?: UserId;
	actor: MembershipActor;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();
		const { result } = yield* writeRelationships(
			{
				organizationIds: issuedGrantOrganizations({
					organizationIds: [
						params.organizationId,
					],
					userIds: params.userIds,
				}),
			},
			Effect.gen(function* () {
				const { managesAdmins } = yield* confirmAuthority({
					organizationId: params.organizationId,
					actor: params.actor,
					userIds: params.userIds,
				});
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
				if (members.length === 0) return undefined;
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

				const handedOver = yield* handOverOwnedContent({
					organizationId: params.organizationId,
					fromUserIds: userIds,
					receiverId: params.receiverId,
					receiverDefault: {
						kind: "actor",
						actorId: params.actor.userId,
					},
				});

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
				return handedOver;
			}),
		);
		return result;
	});

/**
 * Adds an existing account to the organization with `role`. Instance admins
 * only; a banned account, or one that is already a member, is refused.
 */
export const addMember = (params: {
	organizationId: OrganizationId;
	userId: UserId;
	role: OrganizationRole;
	actor: Extract<
		MembershipActor,
		{
			kind: "instance-admin";
		}
	>;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { result } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				const [target] = yield* lockAsInstanceAdmin({
					actorId: params.actor.userId,
					userIds: [
						params.userId,
					],
				});
				const [organization] = yield* db
					.select({
						id: dbSchema.organization.id,
					})
					.from(dbSchema.organization)
					.where(eq(dbSchema.organization.id, params.organizationId));
				if (!organization)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "ORGANIZATION_NOT_FOUND",
							message: "Organization not found",
						}),
					);
				if (!target)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "USER_NOT_FOUND",
							id: params.userId,
							message: "User not found",
						}),
					);
				if (target.banned)
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "USER_BANNED",
							message: "A banned account cannot join an organization.",
						}),
					);
				// The organization lock serializes adds, so the check holds.
				const [existing] = yield* db
					.select({
						id: dbSchema.member.id,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							eq(dbSchema.member.userId, params.userId),
						),
					);
				if (existing)
					return yield* Effect.fail(
						new AppErrors.ConflictError({
							reason: "ALREADY_EXISTS",
							message: "This account is already a member.",
						}),
					);
				const [member] = yield* db
					.insert(dbSchema.member)
					.values({
						organizationId: params.organizationId,
						userId: params.userId,
						role: params.role,
						createdAt: new Date(),
					})
					.returning({
						...getColumns(dbSchema.member),
					});
				yield* recordRelationshipFacts(
					RelationshipFact.OrganizationRoleChanged({
						organizationId: params.organizationId,
						userId: params.userId,
						from: null,
						to: params.role,
					}),
				);
				return member;
			}),
		);
		return result;
	});

/**
 * Accepts an invitation addressed to `email` and adds the user with its role.
 * A user who is already a member keeps their role.
 */
export const acceptInvitation = (params: {
	invitationId: OrganizationInvitationId;
	userId: UserId;
	email: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const notFound = new AppErrors.NotFoundError({
			reason: "INVITATION_NOT_FOUND",
			id: params.invitationId,
			message: "Organization invitation not found",
		});
		const [target] = yield* db
			.select({
				organizationId: dbSchema.invitation.organizationId,
			})
			.from(dbSchema.invitation)
			.where(eq(dbSchema.invitation.id, params.invitationId));
		if (!target) return yield* Effect.fail(notFound);

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
					.where(eq(dbSchema.invitation.id, params.invitationId))
					.for("update");
				if (!invitation) return yield* Effect.fail(notFound);
				if (normalizeEmail(invitation.email) !== normalizeEmail(params.email))
					return yield* Effect.fail(
						new AppErrors.ForbiddenError({
							reason: "INVITATION_RESPONSE_FORBIDDEN",
							message: "You are not allowed to respond to this invitation",
							data: {
								permission: "respond",
								entityType: "organizationInvitation",
							},
						}),
					);
				if (invitation.expiresAt < new Date())
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "INVITATION_EXPIRED",
							message: "Invitation has expired",
						}),
					);
				if (invitation.status !== "pending")
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "INVITATION_REQUIRED",
							message:
								"A pending, unexpired invitation for this address is required",
						}),
					);

				const [existing] = yield* db
					.select({
						role: dbSchema.member.role,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, invitation.organizationId),
							eq(dbSchema.member.userId, params.userId),
						),
					);
				const role = existing?.role ?? invitation.role;
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
			organizationId: target.organizationId,
			zedToken,
		};
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

/**
 * Deletes accounts with their memberships, sessions, access, chats and chat
 * uploads. What they own goes, per organization, to the receiver named in
 * `receivers` or to its earliest admin. Every organization they belong to
 * keeps an admin, and the instance keeps an instance admin.
 */
export const deleteAccounts = (params: {
	userIds: readonly UserId[];
	receivers?: readonly {
		organizationId: OrganizationId;
		userId: UserId;
	}[];
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

		const { result: deleted } = yield* writeRelationships(
			{
				organizationIds: Effect.map(
					Effect.all([
						membershipOrganizations(userIds),
						accountAccessOrganizations(userIds),
						ownedContentOrganizations(userIds),
					]),
					(lists) => lists.flat(),
				),
			},
			Effect.gen(function* () {
				const existingUsers = yield* lockAsInstanceAdmin({
					actorId: params.actorId,
					userIds,
				});
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

				yield* handOverAccountsContent({
					userIds,
					receivers: params.receivers ?? [],
				});
				yield* deleteChatsWhere(inArray(dbSchema.chat.userId, userIds));
				const chatUploads = yield* db
					.select({
						id: dbSchema.asset.id,
					})
					.from(dbSchema.asset)
					.where(
						and(
							inArray(dbSchema.asset.userId, userIds),
							eq(dbSchema.asset.keptIn, "chat"),
						),
					);
				const uploads = yield* deleteResources({
					resourceType: "asset",
					resourceIds: chatUploads.map((upload) => upload.id),
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
					.where(inArray(dbSchema.user.id, userIds));
				return {
					images: existingUsers.map((user) => user.image),
					uploads,
				};
			}),
		);
		yield* deleteImages(deleted.images);
		yield* removeDeletedResourceData([
			deleted.uploads,
		]);

		return userIds.length;
	});

/**
 * Bans an account and ends its sessions. Every organization it administers
 * keeps another admin who can sign in, and the instance keeps an instance
 * admin.
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
				yield* lockAsInstanceAdmin({
					actorId: params.actorId,
					userIds: [
						params.userId,
					],
				});
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

				const banned = yield* db
					.update(dbSchema.user)
					.set({
						banned: true,
						banReason: params.reason ?? null,
						banExpires: null,
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.user.id, params.userId))
					.returning({
						id: dbSchema.user.id,
					});
				if (banned.length === 0)
					return yield* Effect.fail(
						new AppErrors.NotFoundError({
							reason: "USER_NOT_FOUND",
							id: params.userId,
							message: "User not found",
						}),
					);
				yield* db
					.delete(dbSchema.session)
					.where(eq(dbSchema.session.userId, params.userId));
			}),
		);
	});
