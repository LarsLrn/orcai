import { QdrantClient } from "@qdrant/qdrant-js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { qdrantCollections } from "./collections";
import { QdrantConfigLive, QdrantConfigService } from "./config";
import { QdrantError } from "./errors";

export class QdrantService extends Context.Tag("QdrantService")<
	QdrantService,
	{
		readonly client: QdrantClient;
		readonly sparseVectorsEnabled: boolean;
	}
>() {}

const ensurePayloadIndex = ({
	qdrant,
	fieldName,
	fieldSchema,
}: {
	qdrant: QdrantClient;
	fieldName: string;
	fieldSchema: {
		type: "uuid" | "integer";
		is_tenant?: boolean;
	};
}) =>
	Effect.tryPromise({
		try: () =>
			qdrant.createPayloadIndex(qdrantCollections.asset.name, {
				field_name: fieldName,
				field_schema: fieldSchema,
			}),
		catch: (cause) =>
			new QdrantError({
				operation: "createCollection",
				cause,
			}),
	}).pipe(
		Effect.catchAll((error) => {
			const message =
				error.cause instanceof Error
					? error.cause.message.toLowerCase()
					: String(error.cause).toLowerCase();

			if (message.includes("already exists")) {
				return Effect.void;
			}

			return Effect.fail(error);
		}),
		Effect.asVoid,
	);

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
			catch: (cause) =>
				new QdrantError({
					operation: "getCollections",
					cause,
				}),
		});

		const exists = collections.collections.some(
			(collection) => collection.name === qdrantCollections.asset.name,
		);

		if (exists) {
			yield* ensurePayloadIndexes(qdrant);
			return;
		}

		yield* Effect.tryPromise({
			try: async () => {
				await qdrant.createCollection(qdrantCollections.asset.name, {
					vectors: {
						dense: {
							size: qdrantCollections.asset.dimensions,
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
			},
			catch: (cause) =>
				new QdrantError({
					operation: "createCollection",
					cause,
				}),
		});

		yield* ensurePayloadIndexes(qdrant);
	});

const ensurePayloadIndexes = (qdrant: QdrantClient) =>
	Effect.all(
		[
			ensurePayloadIndex({
				qdrant,
				fieldName: qdrantCollections.asset.index.blockId,
				fieldSchema: {
					type: "uuid",
					is_tenant: true,
				},
			}),
			ensurePayloadIndex({
				qdrant,
				fieldName: qdrantCollections.asset.index.chunkIndex,
				fieldSchema: {
					type: "integer",
				},
			}),
			ensurePayloadIndex({
				qdrant,
				fieldName: qdrantCollections.asset.index.chunkPageStart,
				fieldSchema: {
					type: "integer",
				},
			}),
			ensurePayloadIndex({
				qdrant,
				fieldName: qdrantCollections.asset.index.chunkPageEnd,
				fieldSchema: {
					type: "integer",
				},
			}),
		],
		{
			discard: true,
		},
	);

export const QdrantServiceLive = Layer.effect(
	QdrantService,
	Effect.gen(function* () {
		const { config } = yield* QdrantConfigService;

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

export const QdrantLive = QdrantServiceLive.pipe(
	Layer.provide(QdrantConfigLive),
);
