import type { AuthzEntityType } from "@orcai/core";
import type { EntityIdFor, SubjectIdFor } from "./entity-id";
import type { RelationshipFor } from "./relationships";

export type TupleMutation<
	Resource extends AuthzEntityType = AuthzEntityType,
	Subject extends AuthzEntityType = AuthzEntityType,
> = {
	resourceType: Resource;
	resourceId: EntityIdFor<Resource>;
	relation: RelationshipFor<Resource>;
	subjectType: Subject;
	subjectId: SubjectIdFor<Subject>;
	subjectRelation?: RelationshipFor<Subject>;
	operation?: "create" | "delete" | "touch";
};
