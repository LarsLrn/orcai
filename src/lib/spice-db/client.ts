import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { SpiceDbService } from "@/lib/effect/services/spice";
import { SpiceDbError } from "@/lib/effect/utils/errors";
import type { EntityType, PermissionFor, RelationshipFor } from "./types";
import {
	createConsistency,
	createResourceReference,
	createSubjectReference,
} from "./utils";

export type TupleMutation<
	Resource extends EntityType = EntityType,
	Subject extends EntityType = EntityType,
> = {
	resourceType: Resource;
	resourceId: string;
	relation: RelationshipFor<Resource>;
	subjectType: Subject;
	subjectId: string;
	subjectRelation?: RelationshipFor<Subject>;
	operation?: "create" | "delete" | "touch";
};

const operationMap = {
	create: v1.RelationshipUpdate_Operation.CREATE,
	delete: v1.RelationshipUpdate_Operation.DELETE,
	touch: v1.RelationshipUpdate_Operation.TOUCH,
} as const;

const toRelationshipUpdate = <
	Resource extends EntityType,
	Subject extends EntityType,
>(
	mutation: TupleMutation<Resource, Subject>,
) =>
	v1.RelationshipUpdate.create({
		relationship: v1.Relationship.create({
			resource: createResourceReference({
				entityType: mutation.resourceType,
				entityId: mutation.resourceId,
			}),
			relation: mutation.relation,
			subject: createSubjectReference({
				entityType: mutation.subjectType,
				entityId: mutation.subjectId,
				optionalRelation: mutation.subjectRelation,
			}),
		}),
		operation: operationMap[mutation.operation ?? "create"],
	});

const extractZedToken = (response: {
	writtenAt?: {
		token?: string;
	};
}) =>
	Effect.fromNullable(response.writtenAt?.token).pipe(
		Effect.mapError(
			() =>
				new SpiceDbError({
					operation: "mutate",
					cause: new Error(
						"Failed to obtain zed token from Spice write response",
					),
				}),
		),
	);

export const writeRelationshipMutations = (
	mutations: readonly TupleMutation[],
) =>
	Effect.gen(function* () {
		if (mutations.length === 0) {
			return {
				zedToken: undefined as string | undefined,
			};
		}

		const { spice } = yield* SpiceDbService;

		const response = yield* Effect.tryPromise({
			try: () =>
				spice.writeRelationships(
					v1.WriteRelationshipsRequest.create({
						updates: mutations.map((mutation) =>
							toRelationshipUpdate(mutation),
						),
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "mutate",
					cause: error,
				}),
		});

		const zedToken = yield* extractZedToken(response);
		return {
			zedToken,
		};
	});

export const checkEntityPermission = <Entity extends EntityType>(params: {
	entityId: string;
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: string;
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

export const checkManyEntityPermissions = <Entity extends EntityType>(params: {
	entityIds: string[];
	entityType: Entity;
	permission: PermissionFor<Entity>;
	userId: string;
	zedToken?: v1.ZedToken["token"] | null | undefined;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const resources = params.entityIds.map((entityId) =>
			createResourceReference({
				entityType: params.entityType,
				entityId,
			}),
		);
		const consistency = createConsistency({
			zedToken: params.zedToken,
		});

		return yield* Effect.tryPromise({
			try: () =>
				spice.checkBulkPermissions(
					v1.CheckBulkPermissionsRequest.create({
						consistency,
						items: resources.map((resource) => ({
							resource,
							permission: params.permission,
							subject: createSubjectReference({
								entityType: "user",
								entityId: params.userId,
							}),
						})),
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "query",
					cause: error,
				}),
		});
	});

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

export const hasPermission = (result: {
	permissionship: v1.CheckPermissionResponse_Permissionship;
}) =>
	result.permissionship ===
	v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
