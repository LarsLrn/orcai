import * as Effect from "effect/Effect";
import { generateEmbedding } from "@/lib/ai/embedding";
import { QdrantService } from "@/lib/effect/services/qdrant";
import { QdrantError } from "@/lib/effect/utils/errors";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { qdrantCollections } from "@/qdrant/qdrant-constants";
import type { QdrantPoints } from "@/types/qdrant";

export const listAssetPoint = authed.assetPoint.list.handler(({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const { client } = yield* QdrantService;

			const filters: Array<{ key: string; match: { value: string | number } }> =
				[];

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

			return yield* Effect.tryPromise({
				try: async () =>
					client.query(qdrantCollections.asset.name, {
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
					}),
				catch: (error) =>
					new QdrantError({
						operation: "query",
						cause: error,
					}),
			}).pipe(
				Effect.map((response) => ({
					data: response.points as QdrantPoints["points"],
				})),
			);
		}),
	),
);
