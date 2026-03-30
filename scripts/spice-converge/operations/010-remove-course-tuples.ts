import { hasDefinition } from "../lib";
import type { SpiceConvergeOperation } from "../types";

export const removeCourseTuplesOperation: SpiceConvergeOperation = {
	id: "010-remove-course-tuples",
	description:
		"Delete legacy bot#course and course:* tuples before deploying course-free schema",
	shouldRun: async (context) => {
		const currentSchema = await context.readCurrentSchema();
		return hasDefinition(currentSchema, "course");
	},
	run: async (context) => {
		context.log("Removing legacy bot#course tuples...");
		const botCourseDeleted = await context.deleteRelationshipsInBatches({
			relationshipFilter: {
				resourceType: "bot",
				optionalRelation: "course",
			},
			batchSize: 1_000,
		});
		context.log(`Deleted ${botCourseDeleted} bot#course tuple(s)`);

		context.log("Removing legacy course:* tuples...");
		const courseDeleted = await context.deleteRelationshipsInBatches({
			relationshipFilter: {
				resourceType: "course",
			},
			batchSize: 1_000,
		});
		context.log(`Deleted ${courseDeleted} course tuple(s)`);
	},
};
