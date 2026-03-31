import { v1 } from "@authzed/authzed-node";
import type { EntityType } from "./types/entity-type";

export const createResourceReference = (params: {
	entityType: EntityType;
	entityId: string;
}) =>
	v1.ObjectReference.create({
		objectType: params.entityType,
		objectId: params.entityId,
	});

export const createSubjectReference = (params: {
	entityType: EntityType;
	entityId: string;
	optionalRelation?: string;
}) =>
	v1.SubjectReference.create({
		object: createResourceReference({
			entityType: params.entityType,
			entityId: params.entityId,
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
