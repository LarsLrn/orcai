import type { Schemas } from "@qdrant/qdrant-js";

type QdrantFilter = Schemas["Filter"];
type QdrantCondition = Schemas["Condition"];
type QdrantPointId = Schemas["ExtendedPointId"];
type QdrantMatchValue = Schemas["ValueVariants"];

type BuildQdrantFilterParams = {
	pointIds?: Array<string | number>;
	assetIds?: Array<string | number>;
	blockId?: string | number;
	page?: number;
	pageFrom?: number;
	pageTo?: number;
	chunkIndices?: number[];
};

const dedupe = <T>(values: T[] | undefined): T[] =>
	Array.from(new Set((values ?? []).filter((value) => value !== undefined)));

const toMatchCondition = (
	key: string,
	value: QdrantMatchValue,
): QdrantCondition => ({
	key,
	match: {
		value,
	},
});

const toHasIdCondition = (ids: QdrantPointId[]): QdrantCondition => ({
	has_id: ids,
});

export const buildQdrantFilter = (
	params: BuildQdrantFilterParams,
): QdrantFilter | undefined => {
	const must: QdrantCondition[] = [];
	const should: QdrantCondition[] = [];

	const assetIds = dedupe(params.assetIds);
	const chunkIndices = dedupe(params.chunkIndices);
	const pointIds = dedupe(params.pointIds) as QdrantPointId[];

	if (assetIds.length === 1) {
		must.push(toMatchCondition("asset_id", assetIds[0]));
	} else if (assetIds.length > 1) {
		should.push(
			...assetIds.map((assetId) => toMatchCondition("asset_id", assetId)),
		);
	}

	if (pointIds.length > 0) {
		must.push(toHasIdCondition(pointIds));
	}

	if (params.blockId !== undefined) {
		must.push(toMatchCondition("block_id", params.blockId));
	}

	const hasPageRange =
		params.pageFrom !== undefined || params.pageTo !== undefined;
	if (params.page !== undefined) {
		must.push(toMatchCondition("page", params.page));
	} else if (hasPageRange) {
		must.push({
			key: "page",
			range: {
				gte: params.pageFrom,
				lte: params.pageTo,
			},
		});
	}

	if (chunkIndices.length === 1) {
		must.push(toMatchCondition("chunk_index", chunkIndices[0]));
	} else if (chunkIndices.length > 1) {
		must.push({
			should: chunkIndices.map((chunkIndex) =>
				toMatchCondition("chunk_index", chunkIndex),
			),
		});
	}

	if (must.length === 0 && should.length === 0) {
		return undefined;
	}

	const filter: QdrantFilter = {};
	if (must.length > 0) filter.must = must;
	if (should.length > 0) filter.should = should;
	return filter;
};
