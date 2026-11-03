import { DB, dbSchema } from "@orcai/db";
import {
	DEFAULT_INVITATION_TTL_DAYS,
	type InstanceOrganizationMemberSortKey,
	type InstanceUserMembershipSortKey,
} from "@orcai/schema";
import { and, asc, eq, getColumns, ilike, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { inviteToOrganization } from "@/lib/authz/organization-invitations";
import {
	addMember as addOrganizationMember,
	changeMemberRole as changeOrganizationMemberRole,
	removeMembers,
} from "@/lib/authz/organization-membership";
import { eligibleReceivers, ownedContent } from "@/lib/authz/ownership";
import * as AppErrors from "@/lib/effect/utils/errors";
import { removeImage } from "@/lib/images/images";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import { pageOf } from "@/lib/orpc/router/helpers/paging";
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
		return yield* pageOf(
			db
				.select({
					organizationId: dbSchema.organization.id,
					name: dbSchema.organization.name,
					slug: dbSchema.organization.slug,
					logo: dbSchema.organization.logo,
					role: dbSchema.member.role,
					joinedAt: dbSchema.member.createdAt,
				})
				.from(dbSchema.member)
				.innerJoin(
					dbSchema.organization,
					eq(dbSchema.organization.id, dbSchema.member.organizationId),
				)
				.where(whereClause),
			input,
			orderBy,
		);
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
		const { data, rowCount } = yield* pageOf(
			db
				.select({
					userId: dbSchema.user.id,
					name: dbSchema.user.name,
					email: dbSchema.user.email,
					image: dbSchema.user.image,
					banned: dbSchema.user.banned,
					role: dbSchema.member.role,
					joinedAt: dbSchema.member.createdAt,
				})
				.from(dbSchema.member)
				.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.member.userId))
				.where(whereClause),
			input,
			orderBy,
		);
		return {
			data: data.map((row) => ({
				...row,
				banned: row.banned ?? false,
			})),
			rowCount,
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
		const { handedOver } = yield* changeOrganizationMemberRole({
			organizationId: input.organizationId,
			userId: input.userId,
			role: input.role,
			receiverId: input.receiverId,
			actor: {
				kind: "instance-admin",
				userId: context.auth.user.id,
			},
		});
		return {
			success: true,
			handedOver: handedOver ?? null,
		};
	});

const removeMember = authed.instance.removeMember
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const handedOver = yield* removeMembers({
			organizationId: input.organizationId,
			userIds: [
				input.userId,
			],
			receiverId: input.receiverId,
			actor: {
				kind: "instance-admin",
				userId: context.auth.user.id,
			},
		});
		return {
			success: true,
			handedOver: handedOver ?? null,
		};
	});

const listOwnedContent = authed.instance.ownedContent
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const data = yield* ownedContent({
			userIds: input.userIds,
			organizationId: input.organizationId,
			receiverDefault: input.organizationId
				? {
						kind: "actor",
						actorId: context.auth.user.id,
					}
				: {
						kind: "first-admin",
					},
		});
		return {
			data,
			rowCount: data.length,
		};
	});

const listReceivers = authed.instance.receivers
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		// Instance admins see every user's email in the user list.
		const data = yield* eligibleReceivers({
			...input,
			canSeeEmail: true,
		});
		return {
			data,
			rowCount: data.length,
		};
	});

const inviteMember = authed.instance.inviteMember
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const { skipped } = yield* inviteToOrganization({
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
			skipped,
		};
	});

const removeUserImage = authed.instance.removeUserImage
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		yield* removeImage({
			kind: "user",
			userId: input.id,
		});
		return {
			success: true,
		};
	});

const removeOrganizationLogo = authed.instance.removeOrganizationLogo
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		yield* removeImage({
			kind: "organization",
			organizationId: input.id,
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
	ownedContent: listOwnedContent,
	receivers: listReceivers,
	inviteMember,
	removeUserImage,
	removeOrganizationLogo,
};
