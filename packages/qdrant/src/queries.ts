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

/** A search wording, with its vector from the active generation's model unless the search is sparse. */
export type RetrievalQuery = {
	readonly text: string;
	readonly vector?: number[];
};

/**
 * The served points matching `filter`. With queries, each wording ranks the
 * points by meaning, by keywords (BM25) or both, as `retrievalMode` says, and
 * Qdrant fuses several rankings by Reciprocal Rank Fusion. A point's score is
 * its cosine similarity or BM25 score when one ranking ran, and its fused rank
 * score otherwise, so only the order compares across searches.
 */
export const queryAssetPoints = (params: {
	queries?: readonly RetrievalQuery[];
	filter?: Schemas["Filter"];
	limit?: number | null;
	retrievalMode?: RetrievalMode;
}) =>
	Effect.gen(function* () {
		const { client, bm25Config } = yield* QdrantService;
		const { collection } = yield* EmbeddingGeneration;
		const limit = params.limit ?? 10;
		const retrievalMode = params.retrievalMode ?? "dense";
		const filter = servedFilter(params.filter);

		// A wording without a vector falls back to keywords.
		const rankings = (params.queries ?? []).flatMap(
			({ text, vector }): Schemas["Prefetch"][] => {
				const dense =
					retrievalMode !== "sparse" && vector && vector.length > 0
						? [
								{
									query: vector,
									using: "dense",
								},
							]
						: [];
				const lexical =
					text.length > 0 && (retrievalMode !== "dense" || dense.length === 0)
						? [
								{
									query: {
										text,
										model: "qdrant/bm25",
										options: bm25Config,
									},
									using: "bm25",
								},
							]
						: [];
				return [
					...dense,
					...lexical,
				];
			},
		);

		const points = yield* qdrantCall("query", async () => {
			const [ranking, ...more] = rankings;
			if (!ranking) {
				const response = await client.scroll(collection, {
					filter,
					limit,
					with_payload: true,
				});
				return response.points;
			}
			const response = await client.query(
				collection,
				more.length === 0
					? {
							...ranking,
							filter,
							limit,
							with_payload: true,
						}
					: {
							prefetch: rankings.map((prefetch) => ({
								...prefetch,
								filter,
								limit,
							})),
							query: {
								fusion: "rrf",
							},
							limit,
							with_payload: true,
						},
			);
			return response.points;
		});

		return yield* parseAssetPoints(points);
	});
