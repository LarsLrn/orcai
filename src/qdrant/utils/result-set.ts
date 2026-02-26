import type { AssetPoint } from "@/lib/orpc/schemas/asset-point";

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
 * Enforces a per-asset diversity cap on an already-ranked list of points.
 * Iterates through points in rank order and admits at most `maxPerAsset`
 * chunks from each unique `asset_id`. Points that would exceed the cap are
 * skipped entirely (not just pushed down), so the cap is hard.
 *
 * A minimum cap of 1 is always enforced to avoid returning an empty result
 * when only one asset matches.
 *
 * @param points      - Points sorted by descending relevance score.
 * @param maxPerAsset - Maximum chunks to admit from any single asset.
 */
export const applyAssetDiversityCap = (
	points: AssetPoint[],
	maxPerAsset: number,
) => {
	const cap = Math.max(1, maxPerAsset);
	const perAssetCount = new Map<string, number>();
	const selected: AssetPoint[] = [];

	for (const point of points) {
		const assetId = point.payload.asset_id;
		const currentCount = perAssetCount.get(assetId) ?? 0;
		if (currentCount >= cap) continue;
		perAssetCount.set(assetId, currentCount + 1);
		selected.push(point);
	}

	return selected;
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
	existing: Map<string, { point: AssetPoint; hitCount: number }>,
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
