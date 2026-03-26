import { v1 } from "@authzed/authzed-node";
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

export const deleteRelationshipsInBatches = async (params: {
	spice: v1.ZedPromiseClientInterface;
	relationshipFilter: RelationshipFilterInput;
	batchSize?: number;
}) => {
	const requestedBatchSize = params.batchSize ?? 1_000;
	if (requestedBatchSize < 1) {
		throw new Error("deleteRelationships batchSize must be at least 1");
	}

	let deletedCount = 0;
	while (true) {
		const response = await params.spice.deleteRelationships(
			v1.DeleteRelationshipsRequest.create({
				relationshipFilter: params.relationshipFilter,
				optionalLimit: requestedBatchSize,
				optionalAllowPartialDeletions: true,
			}),
		);

		deletedCount += parseDeletedCount(response.relationshipsDeletedCount);

		if (
			response.deletionProgress !==
			v1.DeleteRelationshipsResponse_DeletionProgress.PARTIAL
		) {
			break;
		}
	}

	return deletedCount;
};
