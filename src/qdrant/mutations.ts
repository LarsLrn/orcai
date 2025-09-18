import pMap from "p-map";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { AssetPointPayload } from "@/lib/orpc/schemas/asset-point";
import type { Block } from "@/lib/orpc/schemas/block";
import { qdrant } from "./qdrant";
import { qdrantCollections } from "./qdrant-constants";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

export const upsertPointsToQdrant = async ({ points }: { points: Point[] }) => {
	const mappedPoints = points.map((point) => ({
		id: point.id,
		vector: point.vector,
		payload: point.payload,
	}));

	// TODO: Uploading chunks one by one is not optimal, but batching was flaking out
	// Specifically this:
	// return qdrant.upsert(qdrantCollections.chunks.name, { points });

	const savePoint = async (point: Point) => {
		await qdrant.upsert(qdrantCollections.asset.name, {
			points: [point],
		});
	};

	await pMap(mappedPoints, savePoint, { concurrency: 10 });
};

export const deletePointsByIdentifier = async ({
	assetId,
	blockId,
}: {
	assetId: Asset["id"];
	blockId: Block["id"] | undefined;
}) => {
	const filters = [
		{
			key: "asset_id",
			match: {
				value: assetId,
			},
		},
	];

	if (blockId !== undefined) {
		filters.push({
			key: "block_id",
			match: {
				value: blockId,
			},
		});
	}

	return await qdrant.delete(qdrantCollections.asset.name, {
		filter: {
			must: filters,
		},
	});
};
