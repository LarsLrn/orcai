import { v1 } from "@authzed/authzed-node";
import type { AuthzEntityType } from "@orcai/core";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { callSpiceDb } from "../service";
import type { TupleMutation } from "../types/tuple-mutation";
import { createResourceReference, createSubjectReference } from "../utils";

const operationMap = {
	create: v1.RelationshipUpdate_Operation.CREATE,
	delete: v1.RelationshipUpdate_Operation.DELETE,
	touch: v1.RelationshipUpdate_Operation.TOUCH,
} as const;

const toRelationshipUpdate = <
	Resource extends AuthzEntityType,
	Subject extends AuthzEntityType,
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
	Effect.fromNullishOr(response.writtenAt?.token).pipe(
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

		const response = yield* callSpiceDb("mutate", (spice) =>
			spice.writeRelationships(
				v1.WriteRelationshipsRequest.create({
					updates: mutations.map((mutation) => toRelationshipUpdate(mutation)),
				}),
			),
		);

		const zedToken = yield* extractZedToken(response);
		return {
			zedToken,
		};
	});
