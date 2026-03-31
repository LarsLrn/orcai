import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import { SpiceDbError } from "../errors";
import { SpiceDbService } from "../service";
import type { RelationshipFilterInput } from "./types";

export const normalizeSchema = (schema: string) =>
	schema.trim().replace(/\r\n/g, "\n");

export const hasDefinition = (schema: string, definitionName: string) => {
	const escaped = definitionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`\\bdefinition\\s+${escaped}\\s*\\{`);
	return pattern.test(schema);
};

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

const isMissingSchemaError = (error: unknown): boolean => {
	const candidate = error instanceof SpiceDbError ? error.cause : error;

	if (!(candidate instanceof Error)) {
		return false;
	}

	const details = [
		candidate.message,
		typeof (
			candidate as {
				details?: unknown;
			}
		).details === "string"
			? ((
					candidate as {
						details?: unknown;
					}
				).details as string)
			: "",
	]
		.join(" ")
		.toLowerCase();

	return (
		(
			candidate as {
				code?: unknown;
			}
		).code === 5 ||
		(
			candidate as {
				grpcCode?: unknown;
			}
		).grpcCode === "NotFound" ||
		details.includes("no schema has been defined")
	);
};

export const readCurrentSchema = Effect.gen(function* () {
	const { spice } = yield* SpiceDbService;

	const response = yield* Effect.tryPromise({
		try: () => spice.readSchema(v1.ReadSchemaRequest.create({})),
		catch: (error) =>
			new SpiceDbError({
				operation: "query",
				cause: error,
			}),
	}).pipe(
		Effect.catchIf(
			(error): error is SpiceDbError => isMissingSchemaError(error),
			() =>
				Effect.succeed(
					v1.ReadSchemaResponse.create({
						schemaText: "",
					}),
				),
		),
	);

	return response.schemaText;
});

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
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;

		yield* Effect.tryPromise({
			try: () =>
				spice.writeSchema(
					v1.WriteSchemaRequest.create({
						schema,
					}),
				),
			catch: (error) =>
				new SpiceDbError({
					operation: "mutate",
					cause: error,
				}),
		});
	});

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

		const { spice } = yield* SpiceDbService;

		let deletedCount = 0;
		while (true) {
			const response = yield* Effect.tryPromise({
				try: () =>
					spice.deleteRelationships(
						v1.DeleteRelationshipsRequest.create({
							relationshipFilter: params.relationshipFilter,
							optionalLimit: requestedBatchSize,
							optionalAllowPartialDeletions: true,
						}),
					),
				catch: (error) =>
					new SpiceDbError({
						operation: "mutate",
						cause: error,
					}),
			});

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
