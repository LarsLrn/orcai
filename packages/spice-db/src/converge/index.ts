export {
	defaultSpiceDbSchemaPath,
	deleteRelationshipsInBatches,
	hasDefinition,
	normalizeSchema,
	readCurrentSchema,
	readTargetSchema,
	rewriteRelationshipsInBatches,
	writeSchema,
} from "./lib";
export { runConvergeStatus, runConvergeUp } from "./runner";
export type { SpiceConvergeRunOptions } from "./types";
