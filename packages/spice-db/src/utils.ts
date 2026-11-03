import { v1 } from "@authzed/authzed-node";
import type { EntityIdFor, SubjectIdFor } from "./types/entity-id";
import type { EntityType } from "./types/entity-type";
import { NEWEST_REVISION, type ReadRevision } from "./types/read-revision";

export const createResourceReference = <Entity extends EntityType>(params: {
	entityType: Entity;
	entityId: EntityIdFor<Entity>;
}) =>
	v1.ObjectReference.create({
		objectType: params.entityType,
		objectId: params.entityId,
	});

export const createSubjectReference = <Entity extends EntityType>(params: {
	entityType: Entity;
	entityId: SubjectIdFor<Entity>;
	optionalRelation?: string;
}) =>
	v1.SubjectReference.create({
		object: v1.ObjectReference.create({
			objectType: params.entityType,
			objectId: params.entityId,
		}),
		optionalRelation: params.optionalRelation,
	});

export const createConsistency = (params: {
	zedToken: ReadRevision | null | undefined;
}) =>
	v1.Consistency.create({
		requirement:
			typeof params.zedToken === "string" && params.zedToken !== ""
				? {
						oneofKind: "atLeastAsFresh",
						atLeastAsFresh: {
							token: params.zedToken,
						},
					}
				: params.zedToken === NEWEST_REVISION
					? {
							oneofKind: "fullyConsistent",
							fullyConsistent: true,
						}
					: {
							oneofKind: "minimizeLatency",
							minimizeLatency: true,
						},
	});
