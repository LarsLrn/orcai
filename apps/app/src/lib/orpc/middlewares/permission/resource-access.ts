import type { EntityIdFor, ResourceType } from "@orcai/spice-db";
import { middlewareGen } from "@orpc/effect";
import * as Effect from "effect/Effect";
import { managedIds, requireReadable } from "@/lib/authz/content-access";
import { readRevision } from "@/lib/authz/zed-token";
import { permissionBase, permissionDenied } from "./core";

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

type ResourceAccess = "read" | "manage_access";

/**
 * Passes when SpiceDB and committed Postgres state agree the user may read
 * the resource, else not found; or manage its access, else denied.
 */
const resourceAccessMiddleware = permissionBase.middleware(
	middlewareGen(function* requireResourceAccess(
		opts,
		input: ResourceTarget & {
			access: ResourceAccess;
		},
	) {
		const reader = {
			userId: opts.context.auth.user.id,
			zedToken: readRevision(opts.context, input),
		};
		if (input.access === "read") {
			yield* requireReadable(input.resourceType, input.resourceId, reader);
		} else {
			const managed = yield* managedIds(
				input.resourceType,
				[
					input.resourceId,
				],
				reader,
			);
			if (!managed.has(input.resourceId)) {
				return yield* Effect.fail(
					permissionDenied({
						entityType: input.resourceType,
						permission: input.access,
						zedToken: reader.zedToken,
					}),
				);
			}
		}
		return yield* opts.next();
	}),
);

/** Reads the resource the input names under `keys.entityId`. */
export const requireReadableEntity = <
	Type extends ResourceType,
	IdKey extends string,
>(
	resourceType: Type,
	keys: {
		entityId: IdKey;
	},
) =>
	resourceAccessMiddleware.adaptInput(
		(input: Record<IdKey, EntityIdFor<Type>> & ZedTokenInput) =>
			({
				access: "read",
				resourceType,
				resourceId: input[keys.entityId],
				zedToken: input.zedToken,
			}) as ResourceTarget & {
				access: "read";
			},
	);

/** Reads, or manages access to, the resource the input names by type and id. */
export const requireResourceAccess = (access: ResourceAccess) =>
	resourceAccessMiddleware.adaptInput((input: ResourceTarget) => ({
		...input,
		access,
	}));
