import { DB } from "@orcai/db";
import type {
	GrantRejection,
	ResourceGrantRole,
	ResourcePrincipalIdentity,
} from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import type { EntityIdFor, ResourceType } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/experimental-effect";
import * as Effect from "effect/Effect";
import {
	hasManageGroups,
	isActiveGroupMember,
} from "@/lib/authz/group-visibility";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { withName } from "@/lib/orpc/middlewares/utils";
import { ensurePermission, permissionBase } from "./core";
import { createResourcePermissionInput } from "./resource";

export type AssertCanGrantPrincipalInput = {
	role: ResourceGrantRole;
	zedToken?: string;
	principals: ResourcePrincipalIdentity[];
} & {
	[Entity in ResourceType]: {
		resourceType: Entity;
		resourceId: EntityIdFor<Entity>;
	};
}[ResourceType];

export const assertCanGrantPrincipalMiddleware = withName(
	permissionBase.middleware(
		middlewareGen(function* (opts, input: AssertCanGrantPrincipalInput) {
			const db = yield* DB;
			const zedToken = getZedToken(opts.context, input);

			yield* ensurePermission({
				context: opts.context,
				input: createResourcePermissionInput(input, "manage_access", zedToken),
			});

			const resourceScopes = yield* db.query.resourceScope.findMany({
				columns: {
					organizationId: true,
				},
				where: {
					AND: [
						{
							resourceType: input.resourceType,
						},
						{
							resourceId: input.resourceId,
						},
						{
							endedAt: {
								isNull: true,
							},
						},
					],
				},
			});

			if (resourceScopes.length === 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "RESOURCE_SCOPE_REQUIRED",
						message:
							"Resource has no active organization scope and cannot be shared",
					}),
				);
			}

			const organizationIds = resourceScopes.map(
				(scope) => scope.organizationId,
			);

			const rejections: GrantRejection[] = [];

			for (const principal of input.principals) {
				if (principal.principalType === "user") {
					const membership = yield* db.query.member.findFirst({
						columns: {
							userId: true,
						},
						where: {
							AND: [
								{
									organizationId: {
										in: organizationIds,
									},
								},
								{
									userId: {
										eq: principal.principalId,
									},
								},
							],
						},
					});

					if (!membership) {
						rejections.push({
							principalId: principal.principalId,
							reason: "USER_NOT_IN_SCOPE",
						});
					}
					continue;
				}

				const group = yield* db.query.group.findFirst({
					columns: {
						organizationId: true,
						kind: true,
						systemKey: true,
					},
					where: {
						AND: [
							{
								id: {
									eq: principal.principalId,
								},
							},
							{
								organizationId: {
									in: organizationIds,
								},
							},
							{
								deletedAt: {
									isNull: true,
								},
							},
						],
					},
				});

				if (!group) {
					rejections.push({
						principalId: principal.principalId,
						reason: "GROUP_NOT_IN_SCOPE",
					});
					continue;
				}

				const isAllMembers =
					group.kind === "system" &&
					group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;

				if (isAllMembers && input.role !== "viewer") {
					rejections.push({
						principalId: principal.principalId,
						reason: "ALL_MEMBERS_VIEWER_ONLY",
					});
					continue;
				}

				// Members grant only to All Members and to their own groups.
				if (!isAllMembers) {
					const manages = yield* hasManageGroups({
						organizationId: group.organizationId,
						userId: opts.context.auth.user.id,
						zedToken,
					});

					if (!manages) {
						const belongs = yield* isActiveGroupMember({
							groupId: principal.principalId,
							userId: opts.context.auth.user.id,
						});

						if (!belongs) {
							rejections.push({
								principalId: principal.principalId,
								reason: "GROUP_NOT_JOINED",
							});
						}
					}
				}
			}

			if (rejections.length > 0) {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						reason: "GRANT_PRINCIPALS_INVALID",
						params: {
							rejections,
						},
						message: "Grant principals rejected",
					}),
				);
			}

			return yield* opts.next();
		}),
	),
	"assertCanGrantPrincipal",
);
