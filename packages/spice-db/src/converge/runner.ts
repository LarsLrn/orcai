import * as Effect from "effect/Effect";
import {
	defaultSpiceDbSchemaPath,
	normalizeSchema,
	readCurrentSchema,
	readTargetSchema,
	writeSchema,
} from "./lib";
import type { SpiceConvergeRunOptions } from "./types";

const resolveSchemaPath = (schemaPathOverride?: string) =>
	schemaPathOverride ?? defaultSpiceDbSchemaPath;

const readSchemas = (schemaPathOverride?: string) =>
	Effect.gen(function* () {
		const targetSchemaPath = resolveSchemaPath(schemaPathOverride);
		const targetSchema = yield* readTargetSchema(targetSchemaPath);
		const currentSchema = yield* readCurrentSchema;
		return {
			targetSchemaPath,
			targetSchema,
			schemaInSync:
				normalizeSchema(currentSchema) === normalizeSchema(targetSchema),
		};
	});

export const runConvergeStatus = (params: SpiceConvergeRunOptions = {}) =>
	Effect.gen(function* () {
		const { targetSchemaPath, schemaInSync } = yield* readSchemas(
			params.schemaPathOverride,
		);

		yield* Effect.logInfo(`Target schema file: ${targetSchemaPath}`);
		yield* Effect.logInfo(
			`Current schema matches target: ${schemaInSync ? "yes" : "no"}`,
		);
	});

export const runConvergeUp = (params: SpiceConvergeRunOptions = {}) =>
	Effect.gen(function* () {
		const { targetSchemaPath, targetSchema, schemaInSync } = yield* readSchemas(
			params.schemaPathOverride,
		);

		if (schemaInSync) {
			yield* Effect.logInfo("SpiceDB schema already matches target schema");
			return;
		}

		if (params.dryRun === true) {
			yield* Effect.logInfo("[dry-run] Would apply target schema");
			return;
		}

		yield* Effect.logInfo(`Applying target schema from ${targetSchemaPath}`);
		yield* writeSchema(targetSchema);
		yield* Effect.logInfo("SpiceDB schema deployed successfully");
	});
