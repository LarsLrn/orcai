import * as Effect from "effect/Effect";
import {
	defaultSpiceDbSchemaPath,
	deleteRelationshipsInBatches,
	normalizeSchema,
	readCurrentSchema as readCurrentSpiceSchema,
	readTargetSchema,
	rewriteRelationshipsInBatches,
	writeSchema,
} from "./lib";
import { operations } from "./operations";
import type { SpiceConvergeContext, SpiceConvergeRunOptions } from "./types";

const createContext = (): SpiceConvergeContext => {
	let schemaCache: string | null = null;

	const readCurrentSchema = () => {
		if (schemaCache !== null) {
			return Effect.succeed(schemaCache);
		}

		return readCurrentSpiceSchema.pipe(
			Effect.tap((schema) =>
				Effect.sync(() => {
					schemaCache = schema;
				}),
			),
		);
	};

	return {
		readCurrentSchema,
		writeSchema: (schema) =>
			writeSchema(schema).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						schemaCache = schema;
					}),
				),
			),
		deleteRelationshipsInBatches: ({ relationshipFilter, batchSize }) =>
			deleteRelationshipsInBatches({
				relationshipFilter,
				batchSize,
			}),
		rewriteRelationshipsInBatches: ({
			relationshipFilter,
			mapRelationship,
			batchSize,
		}) =>
			rewriteRelationshipsInBatches({
				relationshipFilter,
				mapRelationship,
				batchSize,
			}),
		log: (message) => Effect.logInfo(message),
	};
};

const formatOperation = (params: {
	id: string;
	description: string;
	shouldRun: boolean;
}) =>
	`- ${params.id}: ${params.shouldRun ? "run" : "skip"} :: ${params.description}`;

const resolveSchemaPath = (schemaPathOverride?: string) =>
	schemaPathOverride ?? defaultSpiceDbSchemaPath;

export const runConvergeStatus = (params: SpiceConvergeRunOptions = {}) =>
	Effect.gen(function* () {
		const targetSchemaPath = resolveSchemaPath(params.schemaPathOverride);
		const context = createContext();

		yield* Effect.logInfo("Spice converge operations:");
		for (const operation of operations) {
			const shouldRun = yield* operation.shouldRun(context);
			yield* Effect.logInfo(
				formatOperation({
					id: operation.id,
					description: operation.description,
					shouldRun,
				}),
			);
		}

		const targetSchema = yield* readTargetSchema(targetSchemaPath);
		const currentSchema = yield* context.readCurrentSchema();
		const schemaInSync =
			normalizeSchema(currentSchema) === normalizeSchema(targetSchema);

		yield* Effect.logInfo(`Target schema file: ${targetSchemaPath}`);
		yield* Effect.logInfo(
			`Current schema matches target: ${schemaInSync ? "yes" : "no"}`,
		);
	});

export const runConvergeUp = (params: SpiceConvergeRunOptions = {}) =>
	Effect.gen(function* () {
		const targetSchemaPath = resolveSchemaPath(params.schemaPathOverride);
		const context = createContext();

		for (const operation of operations) {
			const shouldRun = yield* operation.shouldRun(context);
			if (!shouldRun) {
				yield* Effect.logInfo(
					`[${operation.id}] Skip: ${operation.description}`,
				);
				continue;
			}

			yield* Effect.logInfo(`[${operation.id}] Run: ${operation.description}`);
			if (params.dryRun === true) {
				continue;
			}

			yield* operation.run({
				...context,
				log: (message) => Effect.logInfo(`[${operation.id}] ${message}`),
			});
		}

		const targetSchema = yield* readTargetSchema(targetSchemaPath);
		const currentSchema = yield* context.readCurrentSchema();
		const schemaInSync =
			normalizeSchema(currentSchema) === normalizeSchema(targetSchema);

		if (schemaInSync) {
			yield* Effect.logInfo("SpiceDB schema already matches target schema");
			return;
		}

		if (params.dryRun === true) {
			yield* Effect.logInfo("[dry-run] Would apply target schema");
			return;
		}

		yield* Effect.logInfo(`Applying target schema from ${targetSchemaPath}`);
		yield* context.writeSchema(targetSchema);
		yield* Effect.logInfo("SpiceDB schema deployed successfully");
	});
