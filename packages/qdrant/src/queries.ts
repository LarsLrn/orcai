import type { RetrievalMode } from "@orcai/schema";
import { assetPointSchema } from "@orcai/schema";
import type { Schemas } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { QdrantError } from "./errors";
import { QdrantService } from "./service";

export const queryAssetPoints = (params: {
	embedding?: number[];
	text?: string;
	filter?: Schemas["Filter"];
	limit?: number | null;
	withPayload?: boolean;
	withVector?: boolean;
	scoreThreshold?: number;
	retrievalMode?: RetrievalMode;
}) =>
	Effect.gen(function* () {
		const { client, collections, bm25Config } = yield* QdrantService;
		const resolvedLimit = params.limit ?? 10;
		const withPayload = params.withPayload ?? true;
		const withVector = params.withVector ?? false;
		const retrievalMode = params.retrievalMode ?? "dense";
		const hasEmbedding =
			Array.isArray(params.embedding) && params.embedding.length > 0;
		const hasText = typeof params.text === "string" && params.text.length > 0;

		const points = yield* Effect.tryPromise({
			try: async () => {
				const queryDense = async () => {
					if (!hasEmbedding) {
						return [];
					}

					const response = await client.query(collections.asset.name, {
						query: params.embedding,
						using: "dense",
						filter: params.filter,
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
						score_threshold: params.scoreThreshold,
					});
					return response.points;
				};

				const querySparse = async () => {
					if (!hasText) {
						return [];
					}

					const response = await client.query(collections.asset.name, {
						query: {
							text: params.text,
							model: "qdrant/bm25",
							options: {
								language: bm25Config.language,
								tokenizer: bm25Config.tokenizer,
								ascii_folding: bm25Config.asciiFolding,
							},
						},
						using: "bm25",
						filter: params.filter,
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
						score_threshold: params.scoreThreshold,
					});
					return response.points;
				};

				const queryHybrid = async () => {
					if (!hasEmbedding || !hasText) {
						return [];
					}

					const response = await client.query(collections.asset.name, {
						prefetch: [
							{
								query: {
									text: params.text,
									model: "qdrant/bm25",
									options: {
										language: bm25Config.language,
										tokenizer: bm25Config.tokenizer,
										ascii_folding: bm25Config.asciiFolding,
									},
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
				};

				const queryMetadataOnly = async () => {
					const response = await client.scroll(collections.asset.name, {
						filter: params.filter,
						limit: resolvedLimit,
						with_payload: withPayload,
						with_vector: withVector,
					});
					return response.points ?? [];
				};

				if (retrievalMode === "hybrid" && hasEmbedding && hasText) {
					return await queryHybrid();
				}

				if (retrievalMode === "dense" && hasEmbedding) {
					return await queryDense();
				}

				if (retrievalMode === "sparse" && hasText) {
					return await querySparse();
				}

				// Fallback to whichever modality is available when the preferred mode cannot run.
				if (hasEmbedding) {
					return await queryDense();
				}

				if (hasText) {
					return await querySparse();
				}

				return await queryMetadataOnly();
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
						z.array(assetPointSchema).parse(
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
