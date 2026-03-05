import type { Schemas } from "@qdrant/qdrant-js";
import type { Embedding } from "ai";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { QdrantService } from "@/lib/effect/services/qdrant";
import { QdrantError } from "@/lib/effect/utils/errors";
import { assetPointSelectSchema } from "@/lib/orpc/schemas/asset-point";
import { qdrantCollections } from "./qdrant-constants";

export const queryAssetPoints = (params: {
	embedding?: Embedding;
	text?: string;
	filter?: Schemas["Filter"];
	limit?: number | null;
	withPayload?: boolean;
	withVector?: boolean;
	scoreThreshold?: number;
}) =>
	Effect.gen(function* () {
		const { client, sparseVectorsEnabled } = yield* QdrantService;
		const resolvedLimit = params.limit ?? 10;
		const withPayload = params.withPayload ?? true;
		const withVector = params.withVector ?? false;

		const points = yield* Effect.tryPromise({
			try: async () => {
				// Hybrid retrieval (sparse + dense, fused with RRF)
				if (params.embedding && params.text) {
					if (!sparseVectorsEnabled) {
						const response = await client.query(qdrantCollections.asset.name, {
							query: params.embedding,
							using: "dense",
							filter: params.filter,
							limit: Math.max(resolvedLimit, 20),
							with_payload: withPayload,
							with_vector: withVector,
							score_threshold: params.scoreThreshold,
						});
						return response.points;
					}

					const response = await client.query(qdrantCollections.asset.name, {
						prefetch: [
							{
								query: {
									text: params.text,
									model: "qdrant/bm25",
								},
								using: "bm25",
								filter: params.filter,
								limit: Math.max(resolvedLimit, 20),
							},
							{
								query: params.embedding,
								using: "dense",
								filter: params.filter,
								limit: Math.max(resolvedLimit, 20),
							},
						],
						query: {
							fusion: "rrf",
						},
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
					});
					return response.points;
				}

				// Dense-only retrieval
				if (params.embedding) {
					const response = await client.query(qdrantCollections.asset.name, {
						query: params.embedding,
						using: "dense",
						filter: params.filter,
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
						score_threshold: params.scoreThreshold,
					});
					return response.points;
				}

				// Sparse-only retrieval
				if (params.text) {
					if (!sparseVectorsEnabled) {
						return [];
					}

					const response = await client.query(qdrantCollections.asset.name, {
						query: {
							text: params.text,
							model: "qdrant/bm25",
						},
						using: "bm25",
						filter: params.filter,
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
						score_threshold: params.scoreThreshold,
					});
					return response.points;
				}

				// Metadata-only retrieval (filters / pointIds / chunk ranges)
				const response = await client.scroll(qdrantCollections.asset.name, {
					filter: params.filter,
					limit: resolvedLimit,
					with_payload: withPayload,
					with_vector: withVector,
				});
				return response.points ?? [];
			},
			catch: (error) =>
				new QdrantError({
					operation: "query",
					cause: error,
				}),
		});

		return yield* Effect.succeed(points).pipe(
			Effect.flatMap((response) =>
				Effect.try({
					try: () =>
						z.array(assetPointSelectSchema).parse(
							response.map((point) => ({
								...point,
								version:
									typeof (point as Record<string, unknown>).version === "number"
										? ((point as Record<string, unknown>).version as number)
										: 0,
								score:
									typeof (point as Record<string, unknown>).score === "number"
										? ((point as Record<string, unknown>).score as number)
										: 0,
							})),
						),
					catch: (error) =>
						new QdrantError({
							operation: "parse_query_response",
							cause: error,
						}),
				}),
			),
		);
	});
