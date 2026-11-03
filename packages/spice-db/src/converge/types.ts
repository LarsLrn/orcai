import type { v1 } from "@authzed/authzed-node";

export type RelationshipFilterInput = Pick<
	v1.RelationshipFilter,
	"resourceType"
> &
	Partial<Omit<v1.RelationshipFilter, "resourceType">>;

export type SpiceConvergeRunOptions = {
	schemaPathOverride?: string;
	dryRun?: boolean;
};
