import type { UserId } from "@orcai/core";
import {
	buildOrderBy,
	DB,
	dbSchema,
	pageOf,
	type SortExpression,
} from "@orcai/db";
import type { OrganizationMemberSortKey } from "@orcai/schema";
import { and, desc, eq, getColumns, ilike, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { effectiveAccess } from "@/lib/authz/effective-access";
import { canSeeEmailIn } from "@/lib/authz/email-visibility";
import {
	changeMemberRole,
	removeMembers,
} from "@/lib/authz/organization-membership";
import { eligibleReceivers, ownedContent } from "@/lib/authz/ownership";
import { readRevision } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";
import { literalSearch } from "@/lib/utils/literal-search";

/** Anyone may read their own membership; reading another's takes `manage_members`. */
const managesOthers = (
	input: {
		userId: UserId;
	},
	userId: UserId,
) => (input.userId === userId ? "read" : "manage_members");

const listOrganizationMembers = authed.organizationMember.list
	.use(requireOrganization("manage_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

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

		const orderBy = buildOrderBy({
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

		return yield* pageOf(
			db
				.select({
					...getColumns(dbSchema.user),
					organizationRole: dbSchema.member.role,
				})
				.from(dbSchema.member)
				.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
				.where(whereClause),
			input,
			orderBy,
		);
	});

const findOrganizationMember = authed.organizationMember.find
	.use(requireOrganization(managesOthers))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

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
	.use(requireOrganization(managesOthers))
	.effect(function* ({ input, context }) {
		return yield* effectiveAccess({
			...input,
			organizationId: context.auth.session.activeOrganizationId,
			zedToken: readRevision(context, input),
		});
	});

const updateOrganizationMember = authed.organizationMember.update
	.use(requireOrganization("manage_members"))
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
	.use(requireOrganization("manage_members"))
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
	.use(requireOrganization("manage_members"))
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
	.use(requireOrganization("manage_members"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const data = yield* eligibleReceivers({
			organizationId,
			search: input.search,
			excluded: input.excluded,
			canSeeEmail: yield* canSeeEmailIn({
				organizationIds: [
					organizationId,
				],
				userId: context.auth.user.id,
				zedToken: readRevision(context, input),
			}),
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
