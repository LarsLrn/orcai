import {
	buildOrderBy,
	DB,
	dbSchema,
	pageOf,
	type SortExpression,
} from "@orcai/db";
import type { InstanceUserSortKey } from "@orcai/schema";
import { desc, eq, ilike, or } from "drizzle-orm";
import { resetTwoFactor } from "@/lib/auth/two-factor-reset";
import { setInstanceRole } from "@/lib/instance/instance-role-change";
import {
	banAccount,
	deleteAccounts,
	unbanAccount,
} from "@/lib/organizations/organization-membership";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import { literalSearch } from "@/lib/utils/literal-search";
import { instanceUserColumns } from "./instance-user-columns";

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

		const orderBy = buildOrderBy({
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

		return yield* pageOf(
			db
				.select({
					...instanceUserColumns,
					membershipCount: db.$count(
						dbSchema.member,
						eq(dbSchema.member.userId, dbSchema.user.id),
					),
				})
				.from(dbSchema.user)
				.where(whereClause),
			input,
			orderBy,
		);
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
		yield* unbanAccount({
			userId: input.userId,
			actorId: context.auth.user.id,
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

const setUserInstanceRole = authed.user.setInstanceRole
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* setInstanceRole({
			userId: input.userId,
			role: input.role,
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
			receivers: input.receivers,
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
	setInstanceRole: setUserInstanceRole,
	delete: deleteUsers,
};
