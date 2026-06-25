import type { GroupId, UserId } from "@orcai/core";
import { DB } from "@orcai/db";
import type { ResourceGrantRole } from "@orcai/schema";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import type { EntityIdFor, ResourceType } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { runMiddlewareEffect } from "@/lib/effect/utils/orpc-helpers";
import { withName } from "@/lib/orpc/middlewares/utils";
import { ensurePermission, getZedToken, permissionBase } from "./core";
import { createResourcePermissionInput } from "./resource";

export type AssertCanGrantPrincipalInput = {
	role: ResourceGrantRole;
	zedToken?: string;
} & {
	[Entity in ResourceType]: {
		resourceType: Entity;
		resourceId: EntityIdFor<Entity>;
	};
}[ResourceType] &
	(
		| {
				principalType: "user";
				principalId: UserId;
		  }
		| {
				principalType: "group";
				principalId: GroupId;
		  }
	);

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
				if (input.principalType === "user") {
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
										eq: input.principalId,
									},
								},
							],
						},
					});

					if (!membership) {
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								message:
									"[CROSS_ORG_PRINCIPAL_FORBIDDEN] User principal must belong to the resource organization scope",
								data: {
									code: "CROSS_ORG_PRINCIPAL_FORBIDDEN",
								},
							}),
						);
					}
				}

				if (input.principalType === "group") {
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
										eq: input.principalId,
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
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								message:
									"[CROSS_ORG_PRINCIPAL_FORBIDDEN] Group principal must belong to the resource organization scope",
								data: {
									code: "CROSS_ORG_PRINCIPAL_FORBIDDEN",
								},
							}),
						);
					}

					if (
						group.kind === "system" &&
						group.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY &&
						input.role !== "viewer"
					) {
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								message:
									"[ALL_MEMBERS_VIEWER_ONLY] All Members group can only receive viewer grants",
								data: {
									code: "ALL_MEMBERS_VIEWER_ONLY",
								},
							}),
						);
					}
				}

				return yield* Effect.promise(() => Promise.resolve(opts.next()));
			}),
		),
	),
	"assertCanGrantPrincipal",
);
