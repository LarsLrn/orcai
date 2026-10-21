import { v1 } from "@authzed/authzed-node";
import { status } from "@grpc/grpc-js";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { SpiceDbService } from "../service";
import type { EntityType } from "../types/entity-type";
import type { TupleMutation } from "../types/tuple-mutation";
import { createResourceReference, createSubjectReference } from "../utils";

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

// The request itself is wrong for the schema, so retrying it fails the same way.
const PERMANENT_WRITE_STATUSES = new Set<number>([
	status.INVALID_ARGUMENT,
	status.FAILED_PRECONDITION,
	status.NOT_FOUND,
	status.ALREADY_EXISTS,
	status.OUT_OF_RANGE,
]);

/**
 * Whether a failed write would fail again unchanged. Unavailability, timeouts,
 * exhaustion and authentication fail every write alike and count as transient.
 */
export const isPermanentWriteFailure = (error: SpiceDbError) => {
	const code =
		error.cause instanceof Error && "code" in error.cause
			? error.cause.code
			: undefined;
	return typeof code === "number" && PERMANENT_WRITE_STATUSES.has(code);
};
