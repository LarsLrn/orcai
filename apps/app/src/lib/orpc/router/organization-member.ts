import { DB, dbSchema } from "@orcai/db";
import type { OrganizationMemberSortKey } from "@orcai/schema";
import { and, count, desc, eq, getColumns, ilike, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { effectiveAccess } from "@/lib/authz/effective-access";
import {
	changeMemberRole,
	removeMembers,
} from "@/lib/authz/organization-membership";
import { eligibleReceivers, ownedContent } from "@/lib/authz/ownership";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	requireOrganizationPermission,
	requirePermission,
} from "@/lib/orpc/middlewares/permission";
import {
	buildOrderBy,
	type SortExpression,
} from "@/lib/orpc/router/helpers/sorting";
import { literalSearch } from "@/lib/utils/literal-search";

const listOrganizationMembers = authed.organizationMember.list
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		yield* requirePermission({
			entityId: organizationId,
			entityType: "organization",
			permission: "manage_members",
			userId: context.auth.user.id,
			zedToken: getZedToken(context, input),
		});

		const search = input.filters?.search?.trim();
		const searchLike = search ? literalSearch(search) : undefined;
		const whereClause = and(
			eq(dbSchema.member.organizationId, organizationId),
			searchLike
				? or(
						ilike(dbSchema.user.name, searchLike),
						ilike(dbSchema.user.email, searchLike),
					)
				: undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				organizationRole: dbSchema.member.role,
				createdAt: dbSchema.user.createdAt,
			} satisfies Record<OrganizationMemberSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.user.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.user.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.user),
						organizationRole: dbSchema.member.role,
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
			data,
			rowCount: rowCount.count,
		};
	});

const findOrganizationMember = authed.organizationMember.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.userId !== context.auth.user.id) {
			yield* requirePermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});
		}

		return yield* db
			.select({
				...getColumns(dbSchema.user),
				organizationRole: dbSchema.member.role,
			})
			.from(dbSchema.member)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					eq(dbSchema.user.id, input.userId),
				),
			)
			.limit(1)
			.pipe(
				Effect.map(([user]) => user),
				Effect.flatMap((userWithMembership) =>
					Effect.fromNullishOr(userWithMembership).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "MEMBER_NOT_FOUND",
									message: "Member not found",
								}),
						),
					),
				),
				Effect.map((user) => ({
					data: user,
				})),
			);
	});

const listMemberAccess = authed.organizationMember.listAccess
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.userId !== context.auth.user.id) {
			yield* requirePermission({
				entityId: organizationId,
				entityType: "organization",
				permission: "manage_members",
				userId: context.auth.user.id,
				zedToken,
			});
		}

		return yield* effectiveAccess({
			...input,
			organizationId,
			zedToken,
		});
	});

const updateOrganizationMember = authed.organizationMember.update
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const { member, handedOver } = yield* changeMemberRole({
			organizationId: context.auth.session.activeOrganizationId,
			userId: input.userId,
			role: input.role,
			receiverId: input.receiverId,
			actor: {
				kind: "member",
				userId: context.auth.user.id,
			},
		});

		return {
			data: member,
			handedOver: handedOver ?? null,
		};
	});

const deleteOrganizationMembers = authed.organizationMember.delete
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const handedOver = yield* removeMembers({
			organizationId: context.auth.session.activeOrganizationId,
			userIds: input.refs.map((ref) => ref.userId),
			receiverId: input.receiverId,
			actor: {
				kind: "member",
				userId: context.auth.user.id,
			},
		});

		return {
			success: true,
			message: "Organization members deleted successfully",
			handedOver: handedOver ?? null,
		};
	});

const listOwnedContent = authed.organizationMember.ownedContent
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const data = yield* ownedContent({
			userIds: input.userIds,
			organizationId: context.auth.session.activeOrganizationId,
			receiverDefault: {
				kind: "actor",
				actorId: context.auth.user.id,
			},
		});
		return {
			data,
			rowCount: data.length,
		};
	});

const listReceivers = authed.organizationMember.receivers
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const data = yield* eligibleReceivers({
			organizationId: context.auth.session.activeOrganizationId,
			search: input.search,
		});
		return {
			data,
			rowCount: data.length,
		};
	});

export const organizationMemberRouter = {
	list: listOrganizationMembers,
	find: findOrganizationMember,
	listAccess: listMemberAccess,
	update: updateOrganizationMember,
	delete: deleteOrganizationMembers,
	ownedContent: listOwnedContent,
	receivers: listReceivers,
};
