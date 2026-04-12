import type { AssetPointPayload } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

export const upsertPointsToQdrant = ({ points }: { points: Point[] }) =>
	Effect.gen(function* () {
		const { client, sparseVectorsEnabled, collections } = yield* QdrantService;

		const mappedPoints = points.map((point) => ({
			id: point.id,
			vector: point.vector,
			payload: point.payload,
		}));

		// TODO: Uploading chunks one by one is not optimal, but batching was flaking out
		// Specifically this:
		// qdrant.upsert(collections.asset.name, { points });

		yield* Effect.forEach(
			mappedPoints,
			(point) =>
				Effect.tryPromise({
					try: async () =>
						client.upsert(collections.asset.name, {
							points: [
								{
									id: point.id,
									vector: sparseVectorsEnabled
										? {
												dense: point.vector,
												bm25: {
													text: point.payload.text,
													model: "qdrant/bm25",
												},
											}
										: {
												dense: point.vector,
											},
									payload: point.payload,
								},
							],
						}),
					catch: (cause) =>
						new QdrantError({
							operation: "upsert",
							cause,
						}),
				}),
			{
				concurrency: 10,
			},
		);
	});

export const deletePointsByIdentifier = ({
	assetId,
	blockId,
}: {
	assetId: AssetPointPayload["asset_id"];
	blockId: AssetPointPayload["block_id"] | undefined;
}) =>
	Effect.gen(function* () {
		const { client, collections } = yield* QdrantService;

		const filters: Array<{
			key: string;
			match: {
				value: string | number;
			};
		}> = [];

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
				client.delete(collections.asset.name, {
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
