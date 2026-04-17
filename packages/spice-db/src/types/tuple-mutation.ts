import type { EntityIdFor, SubjectIdFor } from "./entity-id";
import type { EntityType } from "./entity-type";
import type { RelationshipFor } from "./relationships";

export type TupleMutation<
	Resource extends EntityType = EntityType,
	Subject extends EntityType = EntityType,
> = {
	resourceType: Resource;
	resourceId: EntityIdFor<Resource>;
	relation: RelationshipFor<Resource>;
	subjectType: Subject;
	subjectId: SubjectIdFor<Subject>;
	subjectRelation?: RelationshipFor<Subject>;
	operation?: "create" | "delete" | "touch";
};
