import { QdrantClient } from "@qdrant/qdrant-js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { AppConfigService } from "@/lib/effect/services/config";
import { QdrantError } from "@/lib/effect/utils/errors";
import { qdrantCollections } from "@/qdrant/qdrant-constants";

export class QdrantService extends Context.Tag("QdrantService")<
	QdrantService,
	{
		readonly client: QdrantClient;
		readonly sparseVectorsEnabled: boolean;
	}
>() {}

const initCollectionIfNeeded = ({
	qdrant,
	sparseVectorsEnabled,
}: {
	qdrant: QdrantClient;
	sparseVectorsEnabled: boolean;
}) =>
	Effect.gen(function* () {
		const collections = yield* Effect.tryPromise({
			try: () => qdrant.getCollections(),
			catch: (error) =>
				new QdrantError({
					operation: "getCollections",
					cause: error,
				}),
		});

		const exists = collections.collections.some(
			(c) => c.name === qdrantCollections.asset.name,
		);

		if (exists) return;

		yield* Effect.tryPromise({
			try: async () => {
				await qdrant.createCollection(qdrantCollections.asset.name, {
					vectors: {
						dense: {
							size: 4096,
							distance: "Cosine",
						},
					},
					...(sparseVectorsEnabled
						? {
								sparse_vectors: {
									bm25: {},
								},
							}
						: {}),
					hnsw_config: {
						payload_m: 16,
						m: 0,
					},
					optimizers_config: {
						default_segment_number: 2,
					},
				});

				await qdrant.createPayloadIndex(qdrantCollections.asset.name, {
					field_name: qdrantCollections.asset.index.blockId,
					field_schema: {
						type: "uuid",
						is_tenant: true,
					},
				});

				await qdrant.createPayloadIndex(qdrantCollections.asset.name, {
					field_name: qdrantCollections.asset.index.chunkIndex,
					field_schema: {
						type: "integer",
					},
				});
			},
			catch: (error) =>
				new QdrantError({
					operation: "createCollection",
					cause: error,
				}),
		});
	});

export const QdrantLive = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const { config } = yield* AppConfigService;

		const client = new QdrantClient({
			url: config.qdrant.url,
			port: null,
			apiKey: Redacted.value(config.qdrant.apiKey),
		});

		yield* initCollectionIfNeeded({
			qdrant: client,
			sparseVectorsEnabled: config.qdrant.enableSparseVectors,
		});

		return {
			client,
			sparseVectorsEnabled: config.qdrant.enableSparseVectors,
		};
	}),
);
