import { DB, dbSchema } from "@orcai/db";
import { count, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	changeMemberRole,
	removeMembers,
} from "@/lib/authz/organization-membership";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { createProcedures } from "@/lib/orpc/implementation/procedures";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";

const listOrganizationMembers = authed.organizationMember.list
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const [data, [rowCount]] = yield* Effect.all(
			[
				db.query.member.findMany({
					where: {
						organizationId: {
							eq: organizationId,
						},
					},
					limit: input.pageSize,
					offset: input.pageIndex * input.pageSize,
				}),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.member)
					.where(eq(dbSchema.member.organizationId, organizationId)),
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
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		return yield* db.query.member
			.findFirst({
				where: {
					AND: [
						{
							userId: {
								eq: input.userId,
							},
						},
						{
							organizationId: {
								eq: organizationId,
							},
						},
					],
				},
			})
			.pipe(
				Effect.flatMap((member) =>
					Effect.fromNullishOr(member).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "MEMBER_NOT_FOUND",
									message: "Member not found",
								}),
						),
					),
				),
				Effect.map((member) => ({
					data: member,
				})),
			);
	});

const updateOrganizationMember = authed.organizationMember.update
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		const member = yield* changeMemberRole({
			organizationId: context.auth.session.activeOrganizationId,
			userId: input.userId,
			role: input.role,
			actor: {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			},
		});

		return {
			data: member,
		};
	});

const deleteOrganizationMembers = authed.organizationMember.delete
	.use(requireOrganizationPermission("manage_members"))
	.effect(function* ({ input, context }) {
		yield* removeMembers({
			organizationId: context.auth.session.activeOrganizationId,
			userIds: input.refs.map((ref) => ref.userId),
			actor: {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			},
		});

		return {
			success: true,
			message: "Organization members deleted successfully",
		};
	});

export const organizationMemberRouter = {
	list: listOrganizationMembers,
	find: findOrganizationMember,
	update: updateOrganizationMember,
	delete: deleteOrganizationMembers,
};

export const organizationMemberProcedures = createProcedures(
	"organizationMember",
	organizationMemberRouter,
);
