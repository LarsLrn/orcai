import type {
	EntityIdFor,
	EntityType,
	RelationshipFor,
	SubjectIdFor,
} from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";

/**
 * Syncs a SpiceDB relationship when the relation name changes for a fixed
 * resource–subject pair (e.g. a user's role on an organization changes from
 * `student` to `admin`).
 *
 * Because SpiceDB stores each relation as a discrete tuple, a role change
 * requires deleting the old tuple and touching the new one. This function
 * derives and applies those mutations, with the following behaviour:
 *
 * - `oldRelation` only → `delete` the old tuple (e.g. member removed)
 * - `newRelation` only → `touch` the new tuple (e.g. member added)
 * - Both provided     → `delete` old + `touch` new (e.g. role changed)
 * - Both equal        → no-op
 * - Both absent       → no-op
 *
 * @param params.oldRelation     - The relation to remove, if any.
 * @param params.newRelation     - The relation to add, if any.
 * @param params.subjectRelation - Optional subject-side relation (e.g. `member`).
 */
export const syncRelationshipTransition = <
	Resource extends EntityType,
	Subject extends EntityType,
>(params: {
	resourceType: Resource;
	resourceId: EntityIdFor<Resource>;
	subjectType: Subject;
	subjectId: SubjectIdFor<Subject>;
	oldRelation?: RelationshipFor<Resource> | null;
	newRelation?: RelationshipFor<Resource> | null;
	subjectRelation?: RelationshipFor<Subject>;
}) =>
	Effect.gen(function* () {
		const authz = yield* AuthzService;

		if (params.oldRelation === params.newRelation) {
			return {
				zedToken: undefined as string | undefined,
			};
		}

		const mutations = [
			...(params.oldRelation
				? [
						{
							resourceType: params.resourceType,
							resourceId: params.resourceId,
							relation: params.oldRelation,
							subjectType: params.subjectType,
							subjectId: params.subjectId,
							subjectRelation: params.subjectRelation,
							operation: "delete" as const,
						},
					]
				: []),
			...(params.newRelation
				? [
						{
							resourceType: params.resourceType,
							resourceId: params.resourceId,
							relation: params.newRelation,
							subjectType: params.subjectType,
							subjectId: params.subjectId,
							subjectRelation: params.subjectRelation,
							operation: "touch" as const,
						},
					]
				: []),
		];

		if (mutations.length === 0) {
			return {
				zedToken: undefined as string | undefined,
			};
		}

		return yield* authz.applyRelationshipMutations({
			mutations,
		});
	});
