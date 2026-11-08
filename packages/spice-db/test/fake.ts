import type { SpiceDbClient } from "../src/service";

const unscripted = (call: string) => () =>
	Promise.reject(new Error(`The test did not script SpiceDB's ${call}.`));

/** A SpiceDB client that answers with `calls` and rejects any call the test did not script. */
export const spiceClient = (calls: Partial<SpiceDbClient>): SpiceDbClient => ({
	checkPermission: unscripted("checkPermission"),
	checkBulkPermissions: unscripted("checkBulkPermissions"),
	lookupResources: unscripted("lookupResources"),
	readRelationships: unscripted("readRelationships"),
	writeRelationships: unscripted("writeRelationships"),
	deleteRelationships: unscripted("deleteRelationships"),
	readSchema: unscripted("readSchema"),
	writeSchema: unscripted("writeSchema"),
	diffSchema: unscripted("diffSchema"),
	...calls,
});
