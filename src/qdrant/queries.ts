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
	filter?: Schemas["Filter"];
	limit?: number | null;
	withPayload?: boolean;
	withVector?: boolean;
	scoreThreshold?: number;
}) =>
	Effect.gen(function* () {
		const { client } = yield* QdrantService;

		return yield* Effect.tryPromise({
			try: async () =>
				client.query(qdrantCollections.asset.name, {
					query: params.embedding,
					filter: params.filter,
					limit: params.limit,
					with_payload: params.withPayload ?? true,
					with_vector: params.withVector ?? false,
					score_threshold: params.scoreThreshold,
				}),
			catch: (error) => new QdrantError({ operation: "query", cause: error }),
		}).pipe(
			Effect.flatMap((response) =>
				Effect.try({
					try: () => z.array(assetPointSelectSchema).parse(response.points),
					catch: (error) =>
						new QdrantError({
							operation: "parse_query_response",
							cause: error,
						}),
				}),
			),
		);
	});
