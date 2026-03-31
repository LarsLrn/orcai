import type { v1 } from "@authzed/authzed-node";
import type * as Effect from "effect/Effect";
import type { SpiceDbError } from "../errors";
import type { SpiceDbService } from "../service";

export type RelationshipFilterInput = Pick<
	v1.RelationshipFilter,
	"resourceType"
> &
	Partial<Omit<v1.RelationshipFilter, "resourceType">>;

export type SpiceConvergeContext = {
	readCurrentSchema: () => Effect.Effect<string, SpiceDbError, SpiceDbService>;
	deleteRelationshipsInBatches: (params: {
		relationshipFilter: RelationshipFilterInput;
		batchSize?: number;
	}) => Effect.Effect<number, SpiceDbError, SpiceDbService>;
	log: (message: string) => Effect.Effect<void, never, never>;
};

export type SpiceConvergeOperation = {
	id: string;
	description: string;
	shouldRun: (
		context: SpiceConvergeContext,
	) => Effect.Effect<boolean, SpiceDbError, SpiceDbService>;
	run: (
		context: SpiceConvergeContext,
	) => Effect.Effect<void, SpiceDbError, SpiceDbService>;
};

export type SpiceConvergeRunOptions = {
	schemaPathOverride?: string;
	dryRun?: boolean;
};
