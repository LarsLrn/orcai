import { DB, dbSchema } from "@orcai/db";
import type { UserSortKey } from "@orcai/schema";
import { and, count, desc, eq, getColumns, ilike, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { effectiveAccess } from "@/lib/authz/effective-access";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requirePermission } from "@/lib/orpc/middlewares/permission";
import {
	buildOrderBy,
	type SortExpression,
} from "@/lib/orpc/router/helpers/sorting";
import { literalSearch } from "@/lib/utils/literal-search";

const listUsers = authed.user.list
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
			} satisfies Record<UserSortKey, SortExpression>,
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

const findUser = authed.user.find
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
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
					eq(dbSchema.user.id, input.id),
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
									reason: "USER_NOT_MEMBER",
									message: "User is not a member of the active organization",
								}),
						),
					),
				),
				Effect.map((user) => ({
					data: user,
				})),
			);
	});

const listUserAccess = authed.user.listAccess
	.use(requireActiveOrganizationMiddleware)
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const zedToken = getZedToken(context, input);

		if (input.id !== context.auth.user.id) {
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
			userId: input.id,
			organizationId,
			zedToken,
		});
	});

export const memberDirectoryRouter = {
	list: listUsers,
	find: findUser,
	listAccess: listUserAccess,
};
