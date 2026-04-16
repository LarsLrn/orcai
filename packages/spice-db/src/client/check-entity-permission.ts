import { v1 } from "@authzed/authzed-node";
import type { UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { SpiceDbService } from "../service";
import type { EntityIdFor } from "../types/entity-id";
import type { EntityType } from "../types/entity-type";
import type { PermissionFor } from "../types/permissions";
import {
	createConsistency,
	createResourceReference,
	createSubjectReference,
} from "../utils";

export const checkEntityPermission = <Entity extends EntityType>(params: {
	entityId: EntityIdFor<Entity>;
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: UserId;
	zedToken: v1.ZedToken["token"] | null | undefined;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const resource = createResourceReference({
			entityType: params.entityType,
			entityId: params.entityId,
		});
		const consistency = createConsistency({
			zedToken: params.zedToken,
		});

		return yield* Effect.tryPromise({
			try: () =>
				spice.checkPermission(
					v1.CheckPermissionRequest.create({
						consistency,
						resource,
						permission: params.permission,
						subject: createSubjectReference({
							entityType: "user",
							entityId: params.userId,
						}),
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "query",
					cause: error,
				}),
		});
	});
