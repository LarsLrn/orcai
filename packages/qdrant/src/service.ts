import { QdrantClient } from "@qdrant/qdrant-js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { type QdrantCollections, qdrantCollections } from "./collections";
import {
	defaultBm25Config,
	QdrantConfigLive,
	QdrantConfigService,
} from "./config";
import { QdrantError } from "./errors";

export class QdrantService extends Context.Tag("QdrantService")<
	QdrantService,
	{
		readonly client: QdrantClient;
		readonly collections: QdrantCollections;
		readonly bm25Config: typeof defaultBm25Config;
	}
>() {}

const getCollectionDenseVectorSize = (vectors: unknown): number | undefined => {
	if (!vectors || typeof vectors !== "object") {
		return undefined;
	}

	if ("dense" in vectors) {
		const denseVector = (
			vectors as {
				dense?: {
					size?: unknown;
				};
			}
		).dense;
		return typeof denseVector?.size === "number" ? denseVector.size : undefined;
	}

	return typeof (
		vectors as {
			size?: unknown;
		}
	).size === "number"
		? (
				vectors as {
					size: number;
				}
			).size
		: undefined;
};

const ensureCollectionMatchesConfig = ({
	qdrant,
	collections,
}: {
	qdrant: QdrantClient;
	collections: QdrantCollections;
}) =>
	Effect.tryPromise({
		try: async () => {
			const collectionInfo = await qdrant.getCollection(collections.asset.name);
			const configuredSize = collections.asset.dimensions;
			const existingSize = getCollectionDenseVectorSize(
				collectionInfo.config?.params?.vectors,
			);

			if (existingSize !== undefined && existingSize !== configuredSize) {
				throw new Error(
					`Qdrant collection "${collections.asset.name}" uses dense vector size ${existingSize}, but EMBEDDING_DIMENSIONS is configured as ${configuredSize}. Changing embeddings on an existing collection is not supported; recreate the collection and reindex assets.`,
				);
			}
		},
		catch: (cause) =>
			new QdrantError({
				operation: "getCollection",
				cause,
			}),
	});

const ensurePayloadIndex = ({
	qdrant,
	collections,
	fieldName,
	fieldSchema,
}: {
	qdrant: QdrantClient;
	collections: QdrantCollections;
	fieldName: string;
	fieldSchema: {
		type: "uuid" | "integer";
		is_tenant?: boolean;
	};
}) =>
	Effect.tryPromise({
		try: () =>
			qdrant.createPayloadIndex(collections.asset.name, {
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
	collections,
}: {
	qdrant: QdrantClient;
	collections: QdrantCollections;
}) =>
	Effect.gen(function* () {
		const existingCollections = yield* Effect.tryPromise({
			try: () => qdrant.getCollections(),
			catch: (cause) =>
				new QdrantError({
					operation: "getCollections",
					cause,
				}),
		});

		const exists = existingCollections.collections.some(
			(collection) => collection.name === collections.asset.name,
		);

		if (exists) {
			yield* ensureCollectionMatchesConfig({
				qdrant,
				collections,
			});
			yield* ensurePayloadIndexes(qdrant, collections);
			return;
		}

		yield* Effect.tryPromise({
			try: async () => {
				await qdrant.createCollection(collections.asset.name, {
					vectors: {
						dense: {
							size: collections.asset.dimensions,
							distance: "Cosine",
						},
					},
					sparse_vectors: {
						bm25: {
							modifier: "idf",
						},
					},
					hnsw_config: {
						payload_m: 16,
						m: 16,
						ef_construct: 128,
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

		yield* ensurePayloadIndexes(qdrant, collections);
	});

const ensurePayloadIndexes = (
	qdrant: QdrantClient,
	collections: QdrantCollections,
) =>
	Effect.all(
		[
			ensurePayloadIndex({
				qdrant,
				collections,
				fieldName: collections.asset.index.assetId,
				fieldSchema: {
					type: "uuid",
				},
			}),
			ensurePayloadIndex({
				qdrant,
				collections,
				fieldName: collections.asset.index.blockId,
				fieldSchema: {
					type: "uuid",
					is_tenant: true,
				},
			}),
			ensurePayloadIndex({
				qdrant,
				collections,
				fieldName: collections.asset.index.chunkIndex,
				fieldSchema: {
					type: "integer",
				},
			}),
			ensurePayloadIndex({
				qdrant,
				collections,
				fieldName: collections.asset.index.chunkPageStart,
				fieldSchema: {
					type: "integer",
				},
			}),
			ensurePayloadIndex({
				qdrant,
				collections,
				fieldName: collections.asset.index.chunkPageEnd,
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
		const collections = yield* qdrantCollections;

		const client = new QdrantClient({
			url: config.qdrant.url,
			port: null,
			apiKey: Redacted.value(config.qdrant.apiKey),
		});

		yield* initCollectionIfNeeded({
			qdrant: client,
			collections,
		});

		return {
			client,
			collections,
			bm25Config: defaultBm25Config,
		};
	}),
);

export const QdrantLive = QdrantServiceLive.pipe(
	Layer.provide(QdrantConfigLive),
);
