import * as Effect from "effect/Effect";
import { hasDefinition } from "../lib";
import type { SpiceConvergeOperation } from "../types";

export const removeCourseTuplesOperation: SpiceConvergeOperation = {
	id: "010-remove-course-tuples",
	description:
		"Delete legacy bot#course and course:* tuples before deploying course-free schema",
	shouldRun: Effect.fn("removeCourseTuplesOperation.shouldRun")(
		function* (context) {
			const currentSchema = yield* context.readCurrentSchema();
			return hasDefinition(currentSchema, "course");
		},
	),
	run: Effect.fn("removeCourseTuplesOperation.run")(function* (context) {
		yield* context.log("Removing legacy bot#course tuples...");
		const botCourseDeleted = yield* context.deleteRelationshipsInBatches({
			relationshipFilter: {
				resourceType: "bot",
				optionalRelation: "course",
			},
			batchSize: 1_000,
		});
		yield* context.log(`Deleted ${botCourseDeleted} bot#course tuple(s)`);

		yield* context.log("Removing legacy course:* tuples...");
		const courseDeleted = yield* context.deleteRelationshipsInBatches({
			relationshipFilter: {
				resourceType: "course",
			},
			batchSize: 1_000,
		});
		yield* context.log(`Deleted ${courseDeleted} course tuple(s)`);
	}),
};
