import { DB, dbSchema } from "@orcai/db";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	type GroupMemberSortKey,
	type GroupSortKey,
} from "@orcai/schema";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	isNull,
	notExists,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	canSeeEmailIn,
	visibleUserColumns,
	visibleUserSearch,
} from "@/lib/authz/email-visibility";
import {
	addGroupMembers,
	createGroup,
	deleteGroups,
	findOrganizationGroup,
	groupMemberCount,
	removeGroupMembers,
	updateGroup,
} from "@/lib/authz/group-lifecycle";
import { visibleGroupScope } from "@/lib/authz/group-visibility";
import { readRevision } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import { literalSearch } from "@/lib/utils/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const listGroups = authed.group.list
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		});

		const queryLike = input.filters?.search
			? literalSearch(input.filters.search.trim())
			: undefined;

		const whereClause = and(
			scope,
			isNull(dbSchema.group.deletedAt),
			queryLike ? ilike(dbSchema.group.name, queryLike) : undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.group.name,
				kind: dbSchema.group.kind,
				memberCount: groupMemberCount,
				createdAt: dbSchema.group.createdAt,
				updatedAt: dbSchema.group.updatedAt,
			} satisfies Record<GroupSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.group.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.group.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.group),
						memberCount: groupMemberCount,
					})
					.from(dbSchema.group)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.group)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

const findGroup = authed.group.find
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		});

		const [group] = yield* db
			.select()
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, input.id),
					scope,
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

		return {
			data: group,
		};
	});

const createGroupProcedure = authed.group.create
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		const created = yield* createGroup({
			organizationId: context.auth.session.activeOrganizationId,
			name: input.name,
			description: input.description,
			actorId: context.auth.user.id,
		});

		return {
			data: created,
		};
	});

const updateGroupProcedure = authed.group.update
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		const updated = yield* updateGroup({
			groupId: input.id,
			organizationId: context.auth.session.activeOrganizationId,
			name: input.name,
			description: input.description,
		});

		return {
			data: updated,
		};
	});

const deleteGroupsProcedure = authed.group.delete
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		yield* deleteGroups({
			organizationId: context.auth.session.activeOrganizationId,
			groupIds: input.refs.map((ref) => ref.id),
		});

		return {
			success: true,
			message: "Groups deleted successfully",
		};
	});

const listGroupMembers = authed.group.listMembers
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const scope = yield* visibleGroupScope({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		});

		const [group] = yield* db
			.select({
				id: dbSchema.group.id,
				organizationId: dbSchema.group.organizationId,
				kind: dbSchema.group.kind,
				systemKey: dbSchema.group.systemKey,
			})
			.from(dbSchema.group)
			.where(
				and(
					eq(dbSchema.group.id, input.groupId),
					scope,
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

		const canSeeEmail = yield* canSeeEmailIn({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		});
		const searchClause = visibleUserSearch({
			pattern: input.query ? literalSearch(input.query.trim()) : undefined,
			canSeeEmail,
		});
		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
			} satisfies Record<GroupMemberSortKey, SortExpression>,
			defaultOrder: [
				asc(dbSchema.user.name),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.user.id,
			},
		});

		if (
			group.kind === "system" &&
			group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY
		) {
			const whereClause = and(
				eq(dbSchema.member.organizationId, organizationId),
				searchClause,
			);

			const [data, [rowCount]] = yield* Effect.all(
				[
					db
						.select({
							user: visibleUserColumns(canSeeEmail),
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.user,
							eq(dbSchema.user.id, dbSchema.member.userId),
						)
						.where(whereClause)
						.orderBy(...orderBy)
						.limit(input.pageSize)
						.offset(input.pageIndex * input.pageSize),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.user,
							eq(dbSchema.user.id, dbSchema.member.userId),
						)
						.where(whereClause),
				],
				{
					concurrency: "unbounded",
				},
			);

			return {
				data: data.map((row) => ({
					user: row.user,
					source: "implicit" as const,
					addedAt: null,
					addedBy: null,
				})),
				rowCount: rowCount.count,
			};
		}

		const whereClause = and(
			eq(dbSchema.groupMember.groupId, group.id),
			isNull(dbSchema.groupMember.removedAt),
			searchClause,
		);

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						user: visibleUserColumns(canSeeEmail),
						addedAt: dbSchema.groupMember.createdAt,
						addedBy: dbSchema.groupMember.addedBy,
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.groupMember.userId),
					)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.groupMember)
					.innerJoin(
						dbSchema.user,
						eq(dbSchema.user.id, dbSchema.groupMember.userId),
					)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: data.map((row) => ({
				user: row.user,
				source: "explicit" as const,
				addedAt: row.addedAt,
				addedBy: row.addedBy,
			})),
			rowCount: rowCount.count,
		};
	});

const listGroupCandidates = authed.group.listCandidates
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const group = yield* findOrganizationGroup({
			groupId: input.groupId,
			organizationId,
		});

		if (group.kind === "system") {
			return {
				data: [],
				rowCount: 0,
			};
		}

		const canSeeEmail = yield* canSeeEmailIn({
			organizationIds: [
				organizationId,
			],
			userId: context.auth.user.id,
			zedToken: readRevision(context),
		});

		const data = yield* db
			.select(visibleUserColumns(canSeeEmail))
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					notExists(
						db
							.select({
								one: sql`1`,
							})
							.from(dbSchema.groupMember)
							.where(
								and(
									eq(dbSchema.groupMember.groupId, group.id),
									eq(dbSchema.groupMember.userId, dbSchema.user.id),
									isNull(dbSchema.groupMember.removedAt),
								),
							),
					),
					visibleUserSearch({
						pattern: input.query
							? literalSearch(input.query.trim())
							: undefined,
						canSeeEmail,
					}),
				),
			)
			.orderBy(dbSchema.user.name)
			.limit(input.limit);

		return {
			data,
			rowCount: data.length,
		};
	});

const addMembers = authed.group.addMembers
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		yield* addGroupMembers({
			groupId: input.groupId,
			organizationId: context.auth.session.activeOrganizationId,
			userIds: input.userIds,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
			message: "Group members updated successfully",
		};
	});

const removeMembers = authed.group.removeMembers
	.use(requireOrganization("manage_groups"))
	.effect(function* ({ input, context }) {
		const removedUserIds = yield* removeGroupMembers({
			groupId: input.groupId,
			organizationId: context.auth.session.activeOrganizationId,
			userIds: input.userIds,
		});

		if (removedUserIds.length === 0) {
			return {
				success: true,
				message: "No active members to remove",
			};
		}

		return {
			success: true,
			message: "Group members removed successfully",
		};
	});

export const groupRouter = {
	list: listGroups,
	create: createGroupProcedure,
	find: findGroup,
	update: updateGroupProcedure,
	delete: deleteGroupsProcedure,
	listMembers: listGroupMembers,
	listCandidates: listGroupCandidates,
	addMembers,
	removeMembers,
};
