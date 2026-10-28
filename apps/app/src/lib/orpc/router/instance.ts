import { DB, dbSchema } from "@orcai/db";
import {
	DEFAULT_INVITATION_TTL_DAYS,
	type InstanceOrganizationMemberSortKey,
	type InstanceUserMembershipSortKey,
} from "@orcai/schema";
import { and, asc, count, eq, getColumns, ilike, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { inviteToOrganization } from "@/lib/authz/organization-invitations";
import {
	addMember as addOrganizationMember,
	changeMemberRole as changeOrganizationMemberRole,
	removeMembers,
} from "@/lib/authz/organization-membership";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	buildOrderBy,
	type SortExpression,
} from "@/lib/orpc/router/helpers/sorting";
import { organizationReadiness as readOrganizationReadiness } from "@/lib/readiness/readiness";
import { literalSearch } from "@/lib/utils/literal-search";

const userNotFound = (id: string) =>
	new AppErrors.NotFoundError({
		reason: "USER_NOT_FOUND",
		id,
		message: "User not found",
	});

const organizationNotFound = () =>
	new AppErrors.NotFoundError({
		reason: "ORGANIZATION_NOT_FOUND",
		message: "Organization not found",
	});

const user = authed.instance.user
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const [found] = yield* db
			.select({
				...getColumns(dbSchema.user),
				membershipCount: db.$count(
					dbSchema.member,
					eq(dbSchema.member.userId, dbSchema.user.id),
				),
			})
			.from(dbSchema.user)
			.where(eq(dbSchema.user.id, input.id));
		if (!found) return yield* Effect.fail(userNotFound(input.id));
		return {
			data: found,
		};
	});

const userMemberships = authed.instance.userMemberships
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const whereClause = and(
			eq(dbSchema.member.userId, input.userId),
			input.query
				? or(
						ilike(dbSchema.organization.name, literalSearch(input.query)),
						ilike(dbSchema.organization.slug, literalSearch(input.query)),
					)
				: undefined,
		);
		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.organization.name,
				role: dbSchema.member.role,
				joinedAt: dbSchema.member.createdAt,
			} satisfies Record<InstanceUserMembershipSortKey, SortExpression>,
			defaultOrder: [
				asc(dbSchema.organization.name),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.organization.id,
			},
		});
		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						organizationId: dbSchema.organization.id,
						name: dbSchema.organization.name,
						slug: dbSchema.organization.slug,
						role: dbSchema.member.role,
						joinedAt: dbSchema.member.createdAt,
					})
					.from(dbSchema.member)
					.innerJoin(
						dbSchema.organization,
						eq(dbSchema.organization.id, dbSchema.member.organizationId),
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
						dbSchema.organization,
						eq(dbSchema.organization.id, dbSchema.member.organizationId),
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

const organization = authed.instance.organization
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const [found] = yield* db
			.select({
				...getColumns(dbSchema.organization),
				memberCount: db.$count(
					dbSchema.member,
					eq(dbSchema.member.organizationId, dbSchema.organization.id),
				),
			})
			.from(dbSchema.organization)
			.where(eq(dbSchema.organization.id, input.id));
		if (!found) return yield* Effect.fail(organizationNotFound());
		return {
			data: found,
		};
	});

const organizationMembers = authed.instance.organizationMembers
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const whereClause = and(
			eq(dbSchema.member.organizationId, input.organizationId),
			input.query
				? or(
						ilike(dbSchema.user.name, literalSearch(input.query)),
						ilike(dbSchema.user.email, literalSearch(input.query)),
					)
				: undefined,
		);
		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.user.name,
				email: dbSchema.user.email,
				role: dbSchema.member.role,
				joinedAt: dbSchema.member.createdAt,
			} satisfies Record<InstanceOrganizationMemberSortKey, SortExpression>,
			defaultOrder: [
				asc(dbSchema.user.name),
			],
			tieBreaker: {
				id: "userId",
				expression: dbSchema.user.id,
			},
		});
		const [rows, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						userId: dbSchema.user.id,
						name: dbSchema.user.name,
						email: dbSchema.user.email,
						banned: dbSchema.user.banned,
						role: dbSchema.member.role,
						joinedAt: dbSchema.member.createdAt,
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
			data: rows.map((row) => ({
				...row,
				banned: row.banned ?? false,
			})),
			rowCount: rowCount.count,
		};
	});

const organizationReadiness = authed.instance.organizationReadiness
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		return {
			data: yield* readOrganizationReadiness(input.organizationId),
		};
	});

const addMember = authed.instance.addMember
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* addOrganizationMember({
			organizationId: input.organizationId,
			userId: input.userId,
			role: input.role,
			actor: {
				kind: "instance-admin",
				userId: context.auth.user.id,
			},
		});
		return {
			success: true,
		};
	});

const changeMemberRole = authed.instance.changeMemberRole
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* changeOrganizationMemberRole({
			organizationId: input.organizationId,
			userId: input.userId,
			role: input.role,
			actor: {
				kind: "instance-admin",
				userId: context.auth.user.id,
			},
		});
		return {
			success: true,
		};
	});

const removeMember = authed.instance.removeMember
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* removeMembers({
			organizationId: input.organizationId,
			userIds: [
				input.userId,
			],
			actor: {
				kind: "instance-admin",
				userId: context.auth.user.id,
			},
		});
		return {
			success: true,
		};
	});

const inviteMember = authed.instance.inviteMember
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		yield* inviteToOrganization({
			organizationId: input.organizationId,
			emails: [
				input.email,
			],
			role: input.role,
			expiresAt: new Date(
				Date.now() + DEFAULT_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
			),
			locale: input.locale ?? context.auth.user.locale ?? "en",
			inviter: {
				id: context.auth.user.id,
				name: context.auth.user.name || context.auth.user.email,
			},
		});
		return {
			success: true,
		};
	});

export const instanceRouter = {
	user,
	userMemberships,
	organization,
	organizationMembers,
	organizationReadiness,
	addMember,
	changeMemberRole,
	removeMember,
	inviteMember,
};
