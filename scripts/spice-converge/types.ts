import type { v1 } from "@authzed/authzed-node";

export type RelationshipFilterInput = Pick<
	v1.RelationshipFilter,
	"resourceType"
> &
	Partial<Omit<v1.RelationshipFilter, "resourceType">>;

export type SpiceConvergeContext = {
	readonly spice: v1.ZedPromiseClientInterface;
	readonly targetSchemaPath: string;
	readCurrentSchema: () => Promise<string>;
	deleteRelationshipsInBatches: (params: {
		relationshipFilter: RelationshipFilterInput;
		batchSize?: number;
	}) => Promise<number>;
	log: (message: string) => void;
};

export type SpiceConvergeOperation = {
	id: string;
	description: string;
	shouldRun: (context: SpiceConvergeContext) => Promise<boolean>;
	run: (context: SpiceConvergeContext) => Promise<void>;
};

export type SpiceConvergeRunParams = {
	spice: v1.ZedPromiseClientInterface;
	targetSchemaPath: string;
	dryRun?: boolean;
};
