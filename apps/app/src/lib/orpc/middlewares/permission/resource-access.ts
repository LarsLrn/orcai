import type { EntityIdFor, ResourceType } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/effect";
import {
	type ResourcePermission,
	requirePermitted,
} from "@/lib/authz/content-access";
import { readRevision } from "@/lib/authz/zed-token";
import { permissionBase } from "./core";

type ZedTokenInput = {
	zedToken?: string | undefined;
};

type ResourceTarget = {
	[Type in ResourceType]: {
		resourceType: Type;
		resourceId: EntityIdFor<Type>;
	};
}[ResourceType] &
	ZedTokenInput;

/**
 * Passes when SpiceDB and committed Postgres state agree the user holds the
 * permission on the resource: else not found for read, denied otherwise.
 */
const resourceAccessMiddleware = permissionBase.middleware(
	middlewareGen(function* requireResourceAccess(
		opts,
		input: ResourceTarget & {
			access: ResourcePermission;
		},
	) {
		yield* requirePermitted(
			input.resourceType,
			[
				input.resourceId,
			],
			{
				userId: opts.context.auth.user.id,
				zedToken: readRevision(opts.context, input),
			},
			input.access,
		);
		return yield* opts.next();
	}),
);

/** Requires `access` on the resource the input names under `keys.entityId`. */
export const requireEntityAccess = <
	Type extends ResourceType,
	IdKey extends string,
>(
	resourceType: Type,
	access: ResourcePermission,
	keys: {
		entityId: IdKey;
	},
) =>
	resourceAccessMiddleware.adaptInput(
		(input: Record<IdKey, EntityIdFor<Type>> & ZedTokenInput) =>
			({
				access,
				resourceType,
				resourceId: input[keys.entityId],
				zedToken: input.zedToken,
			}) as ResourceTarget & {
				access: ResourcePermission;
			},
	);

/** Requires `access` on the resource the input names by type and id. */
export const requireResourceAccess = (access: ResourcePermission) =>
	resourceAccessMiddleware.adaptInput((input: ResourceTarget) => ({
		...input,
		access,
	}));
