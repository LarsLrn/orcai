export {
	defaultSpiceDbSchemaPath,
	deleteRelationshipsInBatches,
	hasDefinition,
	normalizeSchema,
	readCurrentSchema,
	readTargetSchema,
	writeSchema,
} from "./lib";
export { runConvergeStatus, runConvergeUp } from "./runner";
export type { SpiceConvergeRunOptions } from "./types";
