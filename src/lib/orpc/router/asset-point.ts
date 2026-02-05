import { generateEmbedding } from "@/lib/ai/embedding";
import { authed } from "@/lib/orpc/implementation/authed";
import { qdrant } from "@/qdrant/qdrant";
import { qdrantCollections } from "@/qdrant/qdrant-constants";
import type { QdrantPoints } from "@/types/qdrant";

export const listAssetPoint = authed.assetPoint.list.handler(
	async ({ input }) => {
		const filters = [];

		if (input.filters.assetId !== undefined) {
			filters.push({
				key: "asset_id",
				match: {
					value: input.filters.assetId,
				},
			});
		}

		if (input.filters.blockId !== undefined) {
			filters.push({
				key: "block_id",
				match: {
					value: input.filters.blockId,
				},
			});
		}

		const { points } = (await qdrant.query(qdrantCollections.asset.name, {
			query: input.filters.search
				? await generateEmbedding(input.filters.search)
				: undefined,
			filter: {
				must: filters,
			},
			limit: input.filters.limit ?? undefined,
			with_payload: true,
			with_vector: false,
			score_threshold: input.filters.search ? 0.5 : undefined,
		})) as QdrantPoints;

		return { data: points };
	},
);
