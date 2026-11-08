import { v1 } from "@authzed/authzed-node";
import type { AuthzEntityType, PermissionFor, UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { callSpiceDb } from "../service";
import type { EntityIdFor } from "../types/entity-id";
import type { ReadRevision } from "../types/read-revision";
import {
	createConsistency,
	createResourceReference,
	createSubjectReference,
} from "../utils";

/** Whether the user holds `permission` on one entity. */
export const checkEntityPermission = <Entity extends AuthzEntityType>(params: {
	entityId: EntityIdFor<Entity>;
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: UserId;
	zedToken?: ReadRevision | null | undefined;
}) =>
	callSpiceDb("query", (spice) =>
		spice.checkPermission(
			v1.CheckPermissionRequest.create({
				consistency: createConsistency({
					zedToken: params.zedToken,
				}),
				resource: createResourceReference({
					entityType: params.entityType,
					entityId: params.entityId,
				}),
				permission: params.permission,
				subject: createSubjectReference({
					entityType: "user",
					entityId: params.userId,
				}),
			}),
		),
	).pipe(
		Effect.map(
			(response) =>
				response.permissionship ===
				v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION,
		),
	);
