import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	type CreateGroupInput,
	type UpdateGroupInput,
} from "@orcai/schema";
import { and, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { detachGroups } from "@/lib/access/resource-access";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import {
	recordRelationshipFacts,
	writeRelationships,
} from "@/lib/authz/relationship-write";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Active members of the selected group; All Members holds every member of its organisation. */
export const groupMemberCount =
	sql<number>`case when ${dbSchema.group.systemKey} = ${ALL_MEMBERS_GROUP_SYSTEM_KEY}
	then (select count(*) from ${dbSchema.member} where ${dbSchema.member.organizationId} = ${dbSchema.group.organizationId})
	else (select count(*) from ${dbSchema.groupMember} where ${dbSchema.groupMember.groupId} = ${dbSchema.group.id} and ${dbSchema.groupMember.removedAt} is null)
end`.mapWith(Number);

/** Ends the active group memberships matching `where` and records their tuples. */
const endGroupMemberships = (where: SQL | undefined, now: Date) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const ended = yield* db
			.update(dbSchema.groupMember)
			.set({
				removedAt: now,
			})
			.where(and(isNull(dbSchema.groupMember.removedAt), where))
			.returning({
				groupId: dbSchema.groupMember.groupId,
				userId: dbSchema.groupMember.userId,
			});
		yield* recordRelationshipFacts(
			...ended.map((membership) =>
				RelationshipFact.GroupMembershipChanged({
					groupId: membership.groupId,
					userId: membership.userId,
					member: false,
				}),
			),
		);
		return ended;
	});

/**
 * Deletes the groups: ends their memberships, revokes their grants and
 * records their tuples.
 */
const endGroups = (
	groups: readonly {
		id: GroupId;
		organizationId: OrganizationId;
		systemKey: string | null;
	}[],
	now: Date,
) =>
	Effect.gen(function* () {
		if (groups.length === 0) return;
		const db = yield* DB;
		const groupIds = groups.map((group) => group.id);
		yield* endGroupMemberships(
			inArray(dbSchema.groupMember.groupId, groupIds),
			now,
		);
		yield* detachGroups({
			groupIds,
			now,
		});
		yield* db
			.update(dbSchema.group)
			.set({
				deletedAt: now,
				updatedAt: now,
			})
			.where(inArray(dbSchema.group.id, groupIds));
		yield* recordRelationshipFacts(
			...groups.map((group) =>
				RelationshipFact.GroupDeleted({
					groupId: group.id,
					organizationId: group.organizationId,
					allMembers: group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY,
				}),
			),
		);
	});

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

/** Creates a custom group in the organisation. */
export const createGroup = (
	params: CreateGroupInput & {
		organizationId: OrganizationId;
		actorId: UserId;
	},
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const now = new Date();

		const { result: created } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				const [created] = yield* db
					.insert(dbSchema.group)
					.values({
						organizationId: params.organizationId,
						name: params.name,
						description: params.description,
						kind: "custom",
						systemKey: null,
						createdBy: params.actorId,
						createdAt: now,
						updatedAt: now,
						deletedAt: null,
					})
					.returning();
				yield* recordRelationshipFacts(
					RelationshipFact.GroupCreated({
						groupId: created.id,
						organizationId: params.organizationId,
						allMembers: false,
					}),
				);
				return created;
			}),
		);

		return created;
	});

/** Renames a custom group of the organisation and sets its description. */
export const updateGroup = (
	params: Omit<UpdateGroupInput, "id"> & {
		groupId: GroupId;
		organizationId: OrganizationId;
	},
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* requireCustomGroup(params);

		const [updated] = yield* db
			.update(dbSchema.group)
			.set({
				name: params.name,
				description: params.description,
				updatedAt: new Date(),
			})
			.where(eq(dbSchema.group.id, params.groupId))
			.returning();

		return updated;
	});

/** Deletes custom groups of the organisation; fails unless all of them exist. */
export const deleteGroups = (params: {
	organizationId: OrganizationId;
	groupIds: readonly GroupId[];
}) =>
	writeRelationships(
		{
			organizationIds: [
				params.organizationId,
			],
		},
		Effect.gen(function* () {
			const db = yield* DB;
			const groups = yield* db
				.select({
					id: dbSchema.group.id,
					organizationId: dbSchema.group.organizationId,
					kind: dbSchema.group.kind,
					systemKey: dbSchema.group.systemKey,
				})
				.from(dbSchema.group)
				.where(
					and(
						inArray(dbSchema.group.id, [
							...params.groupIds,
						]),
						eq(dbSchema.group.organizationId, params.organizationId),
						isNull(dbSchema.group.deletedAt),
					),
				);

			if (groups.length !== params.groupIds.length) {
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						reason: "GROUP_NOT_FOUND",
						message: "One or more groups were not found",
					}),
				);
			}

			if (groups.some((group) => group.kind === "system")) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "SYSTEM_GROUP_IMMUTABLE",
						message: "System groups cannot be deleted",
					}),
				);
			}

			yield* endGroups(groups, new Date());
		}),
	);

/**
 * Deletes every group of the organisations, All Members included. Call it in
 * the {@link writeRelationships} that deletes them.
 */
export const deleteOrganizationGroups = (params: {
	organizationIds: readonly OrganizationId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const groups = yield* db
			.select({
				id: dbSchema.group.id,
				organizationId: dbSchema.group.organizationId,
				systemKey: dbSchema.group.systemKey,
			})
			.from(dbSchema.group)
			.where(
				and(
					inArray(dbSchema.group.organizationId, [
						...params.organizationIds,
					]),
					isNull(dbSchema.group.deletedAt),
				),
			);
		yield* endGroups(groups, params.now);
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
		const now = new Date();

		const { result: removedUserIds } = yield* writeRelationships(
			{
				organizationIds: [
					params.organizationId,
				],
			},
			Effect.gen(function* () {
				yield* requireCustomGroup(params);

				const removed = yield* endGroupMemberships(
					and(
						eq(dbSchema.groupMember.groupId, params.groupId),
						inArray(dbSchema.groupMember.userId, params.userIds),
					),
					now,
				);
				return removed.map(({ userId }) => userId);
			}),
		);

		return removedUserIds;
	});

/**
 * Ends the users' active group memberships, in one organisation's groups when
 * given. Call it in a {@link writeRelationships} holding their locks.
 */
export const leaveGroups = (params: {
	organizationId?: OrganizationId;
	userIds: readonly UserId[];
	now: Date;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		yield* endGroupMemberships(
			and(
				inArray(dbSchema.groupMember.userId, [
					...params.userIds,
				]),
				inArray(
					dbSchema.groupMember.groupId,
					db
						.select({
							id: dbSchema.group.id,
						})
						.from(dbSchema.group)
						.where(
							and(
								isNull(dbSchema.group.deletedAt),
								params.organizationId
									? eq(dbSchema.group.organizationId, params.organizationId)
									: undefined,
							),
						),
				),
			),
			params.now,
		);
	});
