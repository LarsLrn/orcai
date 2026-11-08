import { v1 } from "@authzed/authzed-node";
import type { AuthzEntityType, PermissionFor, UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { callSpiceDb } from "../service";
import type { EntityIdFor } from "../types/entity-id";
import type { ReadRevision } from "../types/read-revision";
import { createConsistency, createSubjectReference } from "../utils";

/** The ids of every `entityType` entity the user holds `permission` on. */
export const lookupEntitiesByPermission = <
	Entity extends AuthzEntityType,
>(params: {
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: UserId;
	zedToken?: ReadRevision | null | undefined;
}) =>
	callSpiceDb("query", (spice) =>
		spice.lookupResources(
			v1.LookupResourcesRequest.create({
				consistency: createConsistency({
					zedToken: params.zedToken,
				}),
				resourceObjectType: params.entityType,
				subject: createSubjectReference({
					entityType: "user",
					entityId: params.userId,
				}),
				permission: params.permission,
			}),
		),
	).pipe(
		Effect.map((response) =>
			response.map((item) => item.resourceObjectId as EntityIdFor<Entity>),
		),
	);
