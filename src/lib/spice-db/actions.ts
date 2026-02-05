import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { SpiceDbService } from "@/lib/effect/services/spice";
import { SpiceDbError } from "@/lib/effect/utils/errors";
import {
	createConsistency,
	createResourceReference,
	createUserReference,
} from "./helpers";
import type { Action, EntityType, Relation } from "./types";

export const createRelation = (params: {
	entityId: string;
	entityType: EntityType;
	userId: string;
	relation: Relation;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const resource = createResourceReference({
			entityType: params.entityType,
			entityId: params.entityId,
		});
		const user = createUserReference({ userId: params.userId });

		return yield* Effect.tryPromise({
			try: () =>
				spice.writeRelationships(
					v1.WriteRelationshipsRequest.create({
						updates: [
							v1.RelationshipUpdate.create({
								relationship: v1.Relationship.create({
									resource,
									relation: params.relation,
									subject: v1.SubjectReference.create({ object: user }),
								}),
								operation: v1.RelationshipUpdate_Operation.CREATE,
							}),
						],
					}),
				),
			catch: (error) => new SpiceDbError({ operation: "mutate", cause: error }),
		}).pipe(
			Effect.flatMap((response) => {
				const token = response.writtenAt?.token;
				if (!token) {
					return Effect.fail(
						new SpiceDbError({
							operation: "mutate",
							cause: new Error(
								"Failed to obtain zed token from Spice write response",
							),
						}),
					);
				}
				return Effect.succeed({
					zedToken: token,
					entityId: params.entityId,
					entityType: params.entityType,
				});
			}),
		);
	});

export const checkRelation = (params: {
	entityId: string;
	entityType: EntityType;
	action: Action;
	userId: string;
	zedToken: v1.ZedToken["token"] | null | undefined;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const resource = createResourceReference({
			entityType: params.entityType,
			entityId: params.entityId,
		});
		const user = createUserReference({ userId: params.userId });
		const consistency = createConsistency({ zedToken: params.zedToken });

		return yield* Effect.tryPromise({
			try: () =>
				spice.checkPermission(
					v1.CheckPermissionRequest.create({
						consistency,
						resource,
						permission: params.action,
						subject: v1.SubjectReference.create({ object: user }),
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "query",
					cause: error,
				}),
		});
	});

export const checkManyRelations = (params: {
	entityIds: string[];
	entityType: EntityType;
	action: Action;
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
		const user = createUserReference({ userId: params.userId });
		const consistency = createConsistency({ zedToken: params.zedToken });

		return yield* Effect.tryPromise({
			try: () =>
				spice.checkBulkPermissions(
					v1.CheckBulkPermissionsRequest.create({
						consistency,
						items: resources.map((resource) => ({
							resource,
							permission: params.action,
							subject: v1.SubjectReference.create({ object: user }),
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

export const listAllowedEntities = (params: {
	entityType: EntityType;
	action: Action;
	userId: string;
	zedToken?: v1.ZedToken["token"] | null | undefined;
}) =>
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		const user = createUserReference({ userId: params.userId });
		const consistency = createConsistency({ zedToken: params.zedToken });

		return yield* Effect.tryPromise({
			try: () =>
				spice.lookupResources(
					v1.LookupResourcesRequest.create({
						consistency,
						resourceObjectType: params.entityType,
						subject: v1.SubjectReference.create({ object: user }),
						permission: params.action,
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "query",
					cause: error,
				}),
		});
	});
