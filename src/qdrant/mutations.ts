import * as Effect from "effect/Effect";
import { QdrantError } from "@/lib/effect/utils/errors";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { AssetPointPayload } from "@/lib/orpc/schemas/asset-point";
import type { Block } from "@/lib/orpc/schemas/block";
import { QdrantService } from "../lib/effect/services/qdrant";
import { qdrantCollections } from "./qdrant-constants";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

export const upsertPointsToQdrant = ({ points }: { points: Point[] }) =>
	Effect.gen(function* () {
		const { client } = yield* QdrantService;

		const mappedPoints = points.map((point) => ({
			id: point.id,
			vector: point.vector,
			payload: point.payload,
		}));

		// TODO: Uploading chunks one by one is not optimal, but batching was flaking out
		// Specifically this:
		// qdrant.upsert(qdrantCollections.chunks.name, { points });

		yield* Effect.forEach(
			mappedPoints,
			(point) =>
				Effect.tryPromise({
					try: async () =>
						client.upsert(qdrantCollections.asset.name, {
							points: [point],
						}),
					catch: (cause) =>
						new QdrantError({
							operation: "upsert",
							cause,
						}),
				}),
			{ concurrency: 10 },
		);
	});

export const deletePointsByIdentifier = ({
	assetId,
	blockId,
}: {
	assetId: Asset["id"];
	blockId: Block["id"] | undefined;
}) =>
	Effect.gen(function* () {
		const { client } = yield* QdrantService;

		const filters: Array<{ key: string; match: { value: string | number } }> =
			[];

		if (assetId !== undefined) {
			filters.push({
				key: "asset_id",
				match: {
					value: assetId,
				},
			});
		}

		if (blockId !== undefined) {
			filters.push({
				key: "block_id",
				match: {
					value: blockId,
				},
			});
		}

		return yield* Effect.tryPromise({
			try: async () =>
				client.delete(qdrantCollections.asset.name, {
					filter: {
						must: filters,
					},
				}),
			catch: (error) =>
				new QdrantError({
					operation: "delete",
					cause: error,
				}),
		});
	});
