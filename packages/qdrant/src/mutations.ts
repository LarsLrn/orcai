import type { AssetPointPayload } from "@orcai/schema";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

interface Point {
	vector: number[];
	id: string;
	payload: AssetPointPayload;
}

// Qdrant rejects request bodies over 32 MiB; 64 points stay far below it.
const UPSERT_BATCH_SIZE = 64;

export const upsertPointsToQdrant = ({ points }: { points: Point[] }) =>
	Effect.gen(function* () {
		const { client, collections, bm25Config } = yield* QdrantService;

		yield* Effect.forEach(
			Arr.chunksOf(points, UPSERT_BATCH_SIZE),
			(batch) =>
				Effect.tryPromise({
					try: async () =>
						client.upsert(collections.asset.name, {
							points: batch.map((point) => ({
								id: point.id,
								vector: {
									dense: point.vector,
									bm25: {
										text: point.payload.lexical_text ?? point.payload.text,
										model: "qdrant/bm25",
										options: bm25Config,
									},
								},
								payload: point.payload,
							})),
						}),
					catch: (cause) =>
						new QdrantError({
							operation: "upsert",
							cause,
						}),
				}),
			{
				concurrency: 4,
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
