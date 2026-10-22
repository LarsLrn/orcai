import { DB, dbSchema } from "@orcai/db";
import type { InstanceUserSortKey } from "@orcai/schema";
import { count, desc, eq, getColumns, ilike, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { auth } from "@/lib/auth/auth";
import { resetTwoFactor } from "@/lib/auth/two-factor-reset";
import {
	banAccount,
	deleteAccounts,
} from "@/lib/authz/organization-membership";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	buildOrderBy,
	type SortExpression,
} from "@/lib/orpc/router/helpers/sorting";
import { literalSearch } from "@/lib/utils/literal-search";

/** Better Auth reads the caller's session from the request headers. */
const requireRequestHeaders = (headers: Headers | undefined) =>
	Effect.fromNullishOr(headers).pipe(
		Effect.mapError(
			() =>
				new AppErrors.BadRequestError({
					reason: "REQUEST_HEADERS_REQUIRED",
					message: "Request headers are required for this action.",
				}),
		),
	);

const listAllUsers = authed.user.listAll
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const search = input.filters?.search?.trim();
		const searchLike = search ? literalSearch(search) : undefined;
		const whereClause = searchLike
			? or(
					ilike(dbSchema.user.name, searchLike),
					ilike(dbSchema.user.email, searchLike),
				)
			: undefined;

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				createdAt: dbSchema.user.createdAt,
			} satisfies Record<InstanceUserSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.user.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.user.id,
			},
		});

		const [users, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.user),
					})
					.from(dbSchema.user)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.user)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		const userIds = users.map((user) => user.id);
		const memberships =
			userIds.length === 0
				? []
				: yield* db
						.select({
							userId: dbSchema.member.userId,
							organizationId: dbSchema.member.organizationId,
							organizationName: dbSchema.organization.name,
							organizationSlug: dbSchema.organization.slug,
							role: dbSchema.member.role,
						})
						.from(dbSchema.member)
						.innerJoin(
							dbSchema.organization,
							eq(dbSchema.organization.id, dbSchema.member.organizationId),
						)
						.where(inArray(dbSchema.member.userId, userIds));

		const membershipsByUser = new Map<
			(typeof memberships)[number]["userId"],
			Array<Omit<(typeof memberships)[number], "userId">>
		>();
		for (const { userId, ...membership } of memberships) {
			const bucket = membershipsByUser.get(userId) ?? [];
			bucket.push(membership);
			membershipsByUser.set(userId, bucket);
		}

		return {
			data: users.map((user) => ({
				...user,
				memberships: membershipsByUser.get(user.id) ?? [],
			})),
			rowCount: rowCount.count,
		};
	});

const banUser = authed.user.ban
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* banAccount({
			userId: input.userId,
			reason: input.reason,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
		};
	});

const unbanUser = authed.user.unban
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const headers = yield* requireRequestHeaders(context.reqHeaders);

		yield* Effect.tryPromise({
			try: () =>
				auth.api.unbanUser({
					body: {
						userId: input.userId,
					},
					headers,
				}),
			catch: (error) =>
				new AppErrors.BadRequestError({
					reason: "USER_UNBAN_FAILED",
					message:
						error instanceof Error
							? error.message
							: "Failed to unban the user.",
					cause: error,
				}),
		});

		return {
			success: true,
		};
	});

const resetUserTwoFactor = authed.user.resetTwoFactor
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* resetTwoFactor({
			userId: input.userId,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
		};
	});

const deleteUsers = authed.user.delete
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const deletedCount = yield* deleteAccounts({
			userIds: input.userIds,
			actorId: context.auth.user.id,
		});

		return {
			success: true,
			deletedCount,
		};
	});

export const instanceAdminRouter = {
	listAll: listAllUsers,
	ban: banUser,
	unban: unbanUser,
	resetTwoFactor: resetUserTwoFactor,
	delete: deleteUsers,
};
