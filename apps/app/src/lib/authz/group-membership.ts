import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

/** The organization's group that is not deleted, or GROUP_NOT_FOUND. */
export const findOrganizationGroup = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [group] = yield* db
			.select({
				id: dbSchema.group.id,
				kind: dbSchema.group.kind,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, params.groupId),
					eq(dbSchema.group.organizationId, params.organizationId),
					isNull(dbSchema.group.deletedAt),
				),
			)
			.limit(1);

		if (!group) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "GROUP_NOT_FOUND",
					message: "Group not found",
				}),
			);
		}

		return group;
	});

/** The custom group of this organisation, or a failure explaining why it cannot be edited. */
const requireCustomGroup = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const group = yield* findOrganizationGroup(params);

		if (group.kind === "system") {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "SYSTEM_GROUP_IMMUTABLE",
					message: "System groups cannot be modified",
				}),
			);
		}

		return group;
	});

/**
 * Adds organization members to a custom group, restoring removed memberships.
 * Fails with GROUP_MEMBERS_INVALID when a user is not a member of the organization.
 */
export const addGroupMembers = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
	userIds: readonly UserId[];
	actorId: UserId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				yield* requireCustomGroup(params);

				const members = yield* db
					.select({
						userId: dbSchema.member.userId,
					})
					.from(dbSchema.member)
					.where(
						and(
							eq(dbSchema.member.organizationId, params.organizationId),
							inArray(dbSchema.member.userId, params.userIds),
						),
					);

				const validUserIds = new Set(members.map((item) => item.userId));
				const rejectedUserIds = params.userIds.filter(
					(userId) => !validUserIds.has(userId),
				);

				if (rejectedUserIds.length > 0) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							reason: "GROUP_MEMBERS_INVALID",
							params: {
								userIds: rejectedUserIds,
							},
							message: "Group members must belong to this organisation",
						}),
					);
				}

				const existing = yield* db
					.select({
						userId: dbSchema.groupMember.userId,
						removedAt: dbSchema.groupMember.removedAt,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, params.groupId),
							inArray(dbSchema.groupMember.userId, params.userIds),
						),
					);

				const existingByUserId = new Map(
					existing.map((row) => [
						row.userId,
						row,
					]),
				);
				const toInsert = params.userIds.filter(
					(userId) => !existingByUserId.has(userId),
				);
				const toRestore = params.userIds.filter(
					(userId) => existingByUserId.get(userId)?.removedAt != null,
				);

				if (toRestore.length > 0) {
					yield* db
						.update(dbSchema.groupMember)
						.set({
							removedAt: null,
							addedBy: params.actorId,
							createdAt: now,
						})
						.where(
							and(
								eq(dbSchema.groupMember.groupId, params.groupId),
								inArray(dbSchema.groupMember.userId, toRestore),
							),
						);
				}

				if (toInsert.length > 0) {
					yield* db.insert(dbSchema.groupMember).values(
						toInsert.map((userId) => ({
							groupId: params.groupId,
							userId,
							addedBy: params.actorId,
							createdAt: now,
							removedAt: null,
						})),
					);
				}

				yield* recordRelationshipFacts(
					...[
						...toInsert,
						...toRestore,
					].map((userId) =>
						RelationshipFact.GroupMembershipChanged({
							groupId: params.groupId,
							userId,
							member: true,
						}),
					),
				);
			}),
		);
	});

/** Removes active members from a custom group and returns the users it removed. */
export const removeGroupMembers = (params: {
	groupId: GroupId;
	organizationId: OrganizationId;
	userIds: readonly UserId[];
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		const { result: removedUserIds } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				yield* requireCustomGroup(params);

				const removed = yield* db
					.update(dbSchema.groupMember)
					.set({
						removedAt: now,
					})
					.where(
						and(
							eq(dbSchema.groupMember.groupId, params.groupId),
							inArray(dbSchema.groupMember.userId, params.userIds),
							isNull(dbSchema.groupMember.removedAt),
						),
					)
					.returning({
						userId: dbSchema.groupMember.userId,
					});

				yield* recordRelationshipFacts(
					...removed.map(({ userId }) =>
						RelationshipFact.GroupMembershipChanged({
							groupId: params.groupId,
							userId,
							member: false,
						}),
					),
				);
				return removed.map(({ userId }) => userId);
			}),
		);

		return removedUserIds;
	});
