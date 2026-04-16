import { v1 } from "@authzed/authzed-node";
import type { EntityIdFor, SubjectIdFor } from "./types/entity-id";
import type { EntityType } from "./types/entity-type";

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
	zedToken: v1.ZedToken["token"] | null | undefined;
}) =>
	v1.Consistency.create({
		requirement: params.zedToken
			? {
					oneofKind: "atLeastAsFresh",
					atLeastAsFresh: {
						token: params.zedToken ?? "",
					},
				}
			: {
					oneofKind: "minimizeLatency",
					minimizeLatency: true,
				},
	});
