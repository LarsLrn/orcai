import { promises as fsp } from "node:fs";
import { v1 } from "@authzed/authzed-node";
import { deleteRelationshipsInBatches, normalizeSchema } from "./lib";
import { operations } from "./operations";
import type { SpiceConvergeContext, SpiceConvergeRunParams } from "./types";

const readSchema = async (spice: v1.ZedPromiseClientInterface) => {
	const response = await spice.readSchema(v1.ReadSchemaRequest.create({}));
	return response.schemaText;
};

const writeSchema = async (params: {
	spice: v1.ZedPromiseClientInterface;
	schema: string;
}) =>
	params.spice.writeSchema(
		v1.WriteSchemaRequest.create({
			schema: params.schema,
		}),
	);

const createContext = (params: {
	spice: v1.ZedPromiseClientInterface;
	targetSchemaPath: string;
}): SpiceConvergeContext => {
	let schemaCache: string | null = null;

	const readCurrentSchema = async () => {
		if (schemaCache === null) {
			schemaCache = await readSchema(params.spice);
		}
		return schemaCache;
	};

	return {
		spice: params.spice,
		targetSchemaPath: params.targetSchemaPath,
		readCurrentSchema,
		deleteRelationshipsInBatches: ({ relationshipFilter, batchSize }) =>
			deleteRelationshipsInBatches({
				spice: params.spice,
				relationshipFilter,
				batchSize,
			}),
		log: (message) => console.log(message),
	};
};

const formatOperation = (params: {
	id: string;
	description: string;
	shouldRun: boolean;
}) =>
	`- ${params.id}: ${params.shouldRun ? "run" : "skip"} :: ${params.description}`;

export async function runConvergeStatus(
	params: SpiceConvergeRunParams,
): Promise<void> {
	const context = createContext({
		spice: params.spice,
		targetSchemaPath: params.targetSchemaPath,
	});

	console.log("Spice converge operations:");
	for (const operation of operations) {
		const shouldRun = await operation.shouldRun(context);
		console.log(
			formatOperation({
				id: operation.id,
				description: operation.description,
				shouldRun,
			}),
		);
	}

	const targetSchema = await fsp.readFile(params.targetSchemaPath, "utf8");
	const currentSchema = await context.readCurrentSchema();
	const schemaInSync =
		normalizeSchema(currentSchema) === normalizeSchema(targetSchema);

	console.log(`\nTarget schema file: ${params.targetSchemaPath}`);
	console.log(`Current schema matches target: ${schemaInSync ? "yes" : "no"}`);
}

export async function runConvergeUp(
	params: SpiceConvergeRunParams,
): Promise<void> {
	const context = createContext({
		spice: params.spice,
		targetSchemaPath: params.targetSchemaPath,
	});

	for (const operation of operations) {
		const shouldRun = await operation.shouldRun(context);
		if (!shouldRun) {
			console.log(`[${operation.id}] Skip: ${operation.description}`);
			continue;
		}

		console.log(`[${operation.id}] Run: ${operation.description}`);
		if (params.dryRun === true) {
			continue;
		}

		await operation.run({
			...context,
			log: (message) => console.log(`[${operation.id}] ${message}`),
		});
	}

	const targetSchema = await fsp.readFile(params.targetSchemaPath, "utf8");
	const currentSchema = await context.readCurrentSchema();
	const schemaInSync =
		normalizeSchema(currentSchema) === normalizeSchema(targetSchema);

	if (schemaInSync) {
		console.log("SpiceDB schema already matches target schema");
		return;
	}

	if (params.dryRun === true) {
		console.log("[dry-run] Would apply target schema");
		return;
	}

	console.log(`Applying target schema from ${params.targetSchemaPath}`);
	await writeSchema({
		spice: params.spice,
		schema: targetSchema,
	});
	console.log("SpiceDB schema deployed successfully");
}
