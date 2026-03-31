import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { SpiceDbService } from "../service";
import type { EntityType } from "../types/entity-type";
import type { PermissionFor } from "../types/permissions";
import { createConsistency, createSubjectReference } from "../utils";

export const lookupEntitiesByPermission = <Entity extends EntityType>(params: {
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: string;
	zedToken?: v1.ZedToken["token"] | null | undefined;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const consistency = createConsistency({
			zedToken: params.zedToken,
		});

		return yield* Effect.tryPromise({
			try: () =>
				spice.lookupResources(
					v1.LookupResourcesRequest.create({
						consistency,
						resourceObjectType: params.entityType,
						subject: createSubjectReference({
							entityType: "user",
							entityId: params.userId,
						}),
						permission: params.permission,
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "query",
					cause: error,
				}),
		});
	});
