import type { AssetPoint } from "@orcai/schema";

/**
 * Picks up to `limit` points from a ranked list: at most `maxPerAsset` per
 * asset first, then the next-best points regardless of asset fill any slots
 * left. The picks keep their rank order.
 */
export const selectDiversePoints = (
	points: AssetPoint[],
	{
		limit,
		maxPerAsset,
	}: {
		limit: number;
		maxPerAsset: number;
	},
) => {
	const perAssetCount = new Map<string, number>();
	const picked = new Set<AssetPoint>();

	for (const point of points) {
		if (picked.size >= limit) break;
		const assetId = point.payload.asset_id;
		const count = perAssetCount.get(assetId) ?? 0;
		if (count >= maxPerAsset) continue;
		perAssetCount.set(assetId, count + 1);
		picked.add(point);
	}

	for (const point of points) {
		if (picked.size >= limit) break;
		picked.add(point);
	}

	return points.filter((point) => picked.has(point));
};
