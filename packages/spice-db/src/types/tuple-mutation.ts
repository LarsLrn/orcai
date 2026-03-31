import type { EntityType } from "./entity-type";
import type { RelationshipFor } from "./relationships";

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
