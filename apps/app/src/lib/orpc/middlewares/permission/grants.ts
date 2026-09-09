import { DB } from "@orcai/db";
import type {
	ResourceGrantRole,
	ResourcePrincipalIdentity,
} from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import type { EntityIdFor, ResourceType } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import {
	hasManageGroups,
	isActiveGroupMember,
} from "@/lib/authz/group-visibility";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { runMiddlewareEffect } from "@/lib/effect/utils/orpc-helpers";
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
	permissionBase.middleware((opts, input: AssertCanGrantPrincipalInput) =>
		runMiddlewareEffect(
			opts,
			Effect.gen(function* () {
				const db = yield* DB;
				const zedToken = getZedToken(opts.context, input);

				yield* ensurePermission({
					context: opts.context,
					input: createResourcePermissionInput(
						input,
						"manage_access",
						zedToken,
					),
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
							message:
								"[RESOURCE_SCOPE_REQUIRED] Resource has no active organization scope and cannot be shared",
							data: {
								allowed: false,
								entityType: input.resourceType,
								permission: "manage_access",
								zedToken,
							},
						}),
					);
				}

				const organizationIds = resourceScopes.map(
					(scope) => scope.organizationId,
				);

				const rejections: string[] = [];

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
							rejections.push(
								`${principal.principalId}: user is not a member of this resource's organization scope`,
							);
						}
						continue;
					}

					const group = yield* db.query.group.findFirst({
						columns: {
							name: true,
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
						rejections.push(
							`${principal.principalId}: group is not part of this resource's organization scope`,
						);
						continue;
					}

					const isAllMembers =
						group.kind === "system" &&
						group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;

					if (isAllMembers && input.role !== "viewer") {
						rejections.push(
							`${principal.principalId}: ${group.name} can only receive viewer grants`,
						);
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
								rejections.push(
									`${principal.principalId}: you can only share with groups you belong to`,
								);
							}
						}
					}
				}

				if (rejections.length > 0) {
					return yield* Effect.fail(
						new AppErrors.BadRequestError({
							message: `[GRANT_PRINCIPALS_INVALID] ${rejections.join("; ")}`,
							data: {
								code: "GRANT_PRINCIPALS_INVALID",
							},
						}),
					);
				}

				return yield* Effect.promise(() => Promise.resolve(opts.next()));
			}),
		),
	),
	"assertCanGrantPrincipal",
);
