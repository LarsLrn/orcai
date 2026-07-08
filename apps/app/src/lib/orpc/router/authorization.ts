import type { UserId } from "@orcai/core";
import type {
	Capability,
	CapabilityEntityType,
	OrganizationCapability,
} from "@orcai/schema";
import {
	checkEntityPermission,
	checkManyEntityPermissions,
	type EntityIdFor,
	type EntityType,
	hasPermission,
	type PermissionFor,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { capabilitySets } from "@/lib/authz/capabilities";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";

const toSpiceEntityType = (entityType: CapabilityEntityType): EntityType =>
	entityType;

const checkCapability = (params: {
	entityType: CapabilityEntityType;
	entityId: string;
	permission: Capability;
	userId: string;
	zedToken?: string;
}) =>
	checkEntityPermission({
		entityType: toSpiceEntityType(params.entityType),
		entityId: params.entityId as EntityIdFor<EntityType>,
		permission: params.permission as PermissionFor<EntityType>,
		userId: params.userId as UserId,
		zedToken: params.zedToken,
	}).pipe(Effect.map((result) => hasPermission(result)));

export const checkAuthorization = authed.authorization.check.effect(function* ({
	input,
	context,
}) {
	const allowed = yield* checkCapability({
		entityType: input.entityType,
		entityId: input.entityId,
		permission: input.permission,
		userId: context.auth.user.id,
		zedToken: input.zedToken,
	});

	return {
		data: {
			allowed,
		},
	};
});

export const checkManyAuthorization = authed.authorization.checkMany.effect(
	function* ({ input, context }) {
		const entities: Record<
			string,
			Record<string, boolean>
		> = Object.fromEntries(
			input.entityIds.map((entityId) => [
				entityId,
				Object.fromEntries(
					input.permissions.map((permission) => [
						permission,
						false,
					]),
				),
			]),
		);

		for (const permission of input.permissions) {
			const result = yield* checkManyEntityPermissions({
				entityType: toSpiceEntityType(input.entityType),
				entityIds: input.entityIds as EntityIdFor<EntityType>[],
				permission: permission as PermissionFor<EntityType>,
				userId: context.auth.user.id as UserId,
				zedToken: input.zedToken,
			});

			for (const pair of result.pairs) {
				const entityId = pair.request?.resource?.objectId;
				if (!entityId || !entities[entityId]) {
					continue;
				}

				entities[entityId][permission] =
					pair.response.oneofKind === "item" &&
					hasPermission({
						permissionship: pair.response.item.permissionship,
					});
			}
		}

		return {
			data: {
				entities,
			},
		};
	},
);

export const organizationCapabilities =
	authed.authorization.organizationCapabilities.effect(function* ({
		input,
		context,
	}) {
		const organizationId = context.auth.session.activeOrganizationId;
		if (!organizationId) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message:
						"An active organization must be selected to check capabilities.",
				}),
			);
		}

		const permissions = input.permissions ?? [
			...capabilitySets.organization,
		];
		const capabilities: Record<string, boolean> = {};

		for (const permission of permissions) {
			capabilities[permission] = yield* checkCapability({
				entityType: "organization",
				entityId: organizationId,
				permission: permission as OrganizationCapability,
				userId: context.auth.user.id,
				zedToken: input.zedToken,
			});
		}

		return {
			data: {
				capabilities,
			},
		};
	});
