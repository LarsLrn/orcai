import type { RetrievalMode } from "@orcai/schema";
import { assetPointSchema } from "@orcai/schema";
import type { Schemas } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { qdrantCall } from "./client";
import { QdrantError } from "./errors";
import { servedFilter } from "./filter";
import { EmbeddingGeneration } from "./generation";
import { QdrantService } from "./service";

// A record without a number gets 0; a number that is not finite still fails.
const unrankedAsZero = z.preprocess(
	(value) => (typeof value === "number" ? value : 0),
	z.number(),
);

const qdrantPointsSchema = z.array(
	assetPointSchema.extend({
		version: unrankedAsZero,
		score: unrankedAsZero,
	}),
);

/** Qdrant records as asset points; records without a score or version get 0. */
export const parseAssetPoints = (points: readonly unknown[]) =>
	Effect.try({
		try: () => qdrantPointsSchema.parse(points),
		catch: (error) =>
			new QdrantError({
				operation: "parse_query_response",
				cause: error,
			}),
	});

/** The served points matching `filter`, ranked by `retrievalMode`. */
export const queryAssetPoints = (params: {
	embedding?: number[];
	text?: string;
	filter?: Schemas["Filter"];
	limit?: number | null;
	scoreThreshold?: number;
	retrievalMode?: RetrievalMode;
}) =>
	Effect.gen(function* () {
		const { client, bm25Config } = yield* QdrantService;
		const { collection } = yield* EmbeddingGeneration;
		const resolvedLimit = params.limit ?? 10;
		const retrievalMode = params.retrievalMode ?? "dense";
		const hasEmbedding =
			Array.isArray(params.embedding) && params.embedding.length > 0;
		const hasText = typeof params.text === "string" && params.text.length > 0;
		const filter = servedFilter(params.filter);

		const points = yield* qdrantCall("query", async () => {
			const queryDense = async () => {
				if (!hasEmbedding) {
					return [];
				}

				const response = await client.query(collection, {
					query: params.embedding,
					using: "dense",
					filter,
					limit: resolvedLimit,
					with_payload: true,
					score_threshold: params.scoreThreshold,
				});
				return response.points;
			};

			const querySparse = async () => {
				if (!hasText) {
					return [];
				}

				const response = await client.query(collection, {
					query: {
						text: params.text,
						model: "qdrant/bm25",
						options: bm25Config,
					},
					using: "bm25",
					filter,
					limit: resolvedLimit,
					with_payload: true,
					score_threshold: params.scoreThreshold,
				});
				return response.points;
			};

			// The threshold is a cosine similarity, so only the dense side takes it; any lexical match counts.
			const queryHybrid = async () => {
				if (!hasEmbedding || !hasText) {
					return [];
				}

				const response = await client.query(collection, {
					prefetch: [
						{
							query: {
								text: params.text,
								model: "qdrant/bm25",
								options: bm25Config,
							},
							using: "bm25",
							filter,
							limit: Math.max(resolvedLimit, 20),
						},
						{
							query: params.embedding,
							using: "dense",
							filter,
							limit: Math.max(resolvedLimit, 20),
							score_threshold: params.scoreThreshold,
						},
					],
					query: {
						fusion: "rrf",
					},
					limit: resolvedLimit,
					with_payload: true,
				});
				return response.points;
			};

			const queryMetadataOnly = async () => {
				const response = await client.scroll(collection, {
					filter,
					limit: resolvedLimit,
					with_payload: true,
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
		});

		return yield* parseAssetPoints(points);
	});
