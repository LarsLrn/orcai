import type { AssetPoint } from "@orcai/schema";

/**
 * Removes duplicate points from an array, keeping the first occurrence of
 * each Qdrant point ID. This is needed because multiple query variants can
 * return the same chunk; deduplication must happen before re-ranking so
 * that each chunk is scored only once.
 */
export const dedupeById = (points: AssetPoint[]) => {
	const seen = new Set<string>();
	return points.filter((point) => {
		const key = String(point.id);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

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

/**
 * Merges a batch of Qdrant results into a running recall-candidate map,
 * keyed by string point ID.
 *
 * On first encounter, the point is inserted with hitCount=1.
 * On collision (same point returned by multiple query variants):
 *   - The copy with the higher score is retained.
 *   - hitCount is incremented.
 *
 * hitCount is later used to apply a small score boost to points that appear
 * across multiple query variants — consensus evidence of relevance.
 *
 * @param existing - Mutable map accumulating candidates across all variants
 *                   and passes.
 * @param points   - New batch of normalized points to merge in.
 */
export const mergeRecallCandidates = (
	existing: Map<
		string,
		{
			point: AssetPoint;
			hitCount: number;
		}
	>,
	points: AssetPoint[],
) => {
	for (const point of points) {
		const key = String(point.id);
		const prev = existing.get(key);

		if (!prev) {
			existing.set(key, {
				point,
				hitCount: 1,
			});
			continue;
		}

		// Keep the higher-scoring version; always increment hitCount.
		existing.set(key, {
			point:
				(prev.point?.score ?? 0) >= (point?.score ?? 0) ? prev.point : point,
			hitCount: prev.hitCount + 1,
		});
	}
};
