import * as Effect from "effect/Effect";
import { deleteRelationshipsInBatches, readCurrentSchema } from "./converge";

/** Definitions without a relation cannot hold relationships. */
const relationshipResourceTypes = (schemaText: string): string[] => {
	const types: string[] = [];
	for (const match of schemaText.matchAll(
		/definition\s+([\w/]+)\s*\{([^}]*)\}/g,
	)) {
		const [, name = "", body = ""] = match;
		if (/\brelation\s+\w+\s*:/.test(body)) types.push(name);
	}
	return types;
};

/**
 * Delete every relationship the current schema can hold, leaving the schema
 * itself in place. Development and end-to-end resets use this to return a
 * stack to an uninitialised instance.
 */
export const resetRelationships = Effect.gen(function* () {
	const schemaText = yield* readCurrentSchema;
	const resourceTypes = relationshipResourceTypes(schemaText);

	let deleted = 0;
	for (const resourceType of resourceTypes) {
		deleted += yield* deleteRelationshipsInBatches({
			relationshipFilter: {
				resourceType,
			},
		});
	}

	return {
		resourceTypes: resourceTypes.length,
		deleted,
	};
});
