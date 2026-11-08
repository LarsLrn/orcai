import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { grpcStatusOf, SpiceDbError } from "../errors";
import { callSpiceDb } from "../service";
import type { RelationshipFilterInput } from "./types";

const parseDeletedCount = (value: string): number => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		return 0;
	}
	return parsed;
};

export const defaultSpiceDbSchemaPath = fileURLToPath(
	new URL("../schema/schema.zed", import.meta.url),
);

/** The written schema, empty when none is written yet. */
export const readCurrentSchema = callSpiceDb("query", (spice) =>
	spice.readSchema(v1.ReadSchemaRequest.create({})),
).pipe(
	Effect.map((response) => response.schemaText),
	Effect.catchIf(
		(error) => grpcStatusOf(error) === "NOT_FOUND",
		() => Effect.succeed(""),
	),
);

/** Whether the written schema means the same as `schema`, whatever the order and layout of its definitions. */
export const schemaMatches = (schema: string) =>
	callSpiceDb("query", (spice) =>
		spice.diffSchema(
			v1.DiffSchemaRequest.create({
				consistency: v1.Consistency.create({
					requirement: {
						oneofKind: "fullyConsistent",
						fullyConsistent: true,
					},
				}),
				comparisonSchema: schema,
			}),
		),
	).pipe(Effect.map((response) => response.diffs.length === 0));

export const readTargetSchema = (schemaPath: string) =>
	Effect.tryPromise({
		try: () => readFile(schemaPath, "utf8"),
		catch: (error) =>
			new SpiceDbError({
				operation: "converge",
				cause: error,
			}),
	});

export const writeSchema = (schema: string) =>
	callSpiceDb("mutate", (spice) =>
		spice.writeSchema(
			v1.WriteSchemaRequest.create({
				schema,
			}),
		),
	).pipe(Effect.asVoid);

export const deleteRelationshipsInBatches = (params: {
	relationshipFilter: RelationshipFilterInput;
	batchSize?: number;
}) =>
	Effect.gen(function* () {
		const requestedBatchSize = params.batchSize ?? 1_000;
		if (requestedBatchSize < 1) {
			return yield* Effect.fail(
				new SpiceDbError({
					operation: "converge",
					cause: new Error("deleteRelationships batchSize must be at least 1"),
				}),
			);
		}

		let deletedCount = 0;
		while (true) {
			const response = yield* callSpiceDb("mutate", (spice) =>
				spice.deleteRelationships(
					v1.DeleteRelationshipsRequest.create({
						relationshipFilter: params.relationshipFilter,
						optionalLimit: requestedBatchSize,
						optionalAllowPartialDeletions: true,
					}),
				),
			);

			deletedCount += parseDeletedCount(response.relationshipsDeletedCount);

			if (
				response.deletionProgress !==
				v1.DeleteRelationshipsResponse_DeletionProgress.PARTIAL
			) {
				break;
			}
		}

		return deletedCount;
	});
