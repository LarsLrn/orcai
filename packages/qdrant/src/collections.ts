import type { QdrantClient } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import { QdrantError } from "./errors";

/** The payload fields asset points are indexed and ordered by. */
export const assetPointIndex = {
	assetId: "asset_id",
	blockId: "block_id",
	chunkIndex: "chunk_index",
	chunkPageStart: "chunkPageStart",
	chunkPageEnd: "chunkPageEnd",
	published: "published",
} as const;

const MODEL_SLUG_LENGTH = 64;

const modelSlug = (model: string) =>
	model
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MODEL_SLUG_LENGTH) || "model";

/** A generation's collection: never reused, and named for its model. */
export const generationCollectionName = (
	prefix: string,
	generation: number,
	model: string,
	dimensions: number,
) => `${prefix}-g${generation}-${modelSlug(model)}-${dimensions}`;

const alreadyExists = (cause: unknown) =>
	/already exists/i.test(
		cause instanceof Error ? cause.message : String(cause),
	);

const qdrantCall = <A>(operation: string, call: () => Promise<A>) =>
	Effect.tryPromise({
		try: call,
		catch: (cause) =>
			new QdrantError({
				operation,
				cause,
			}),
	});

const payloadIndexes = [
	[
		assetPointIndex.assetId,
		{
			type: "uuid",
		},
	],
	[
		assetPointIndex.blockId,
		{
			type: "uuid",
			is_tenant: true,
		},
	],
	[
		assetPointIndex.chunkIndex,
		{
			type: "integer",
		},
	],
	[
		assetPointIndex.chunkPageStart,
		{
			type: "integer",
		},
	],
	[
		assetPointIndex.chunkPageEnd,
		{
			type: "integer",
		},
	],
	[
		assetPointIndex.published,
		{
			type: "bool",
		},
	],
] as const;

/** Creates the collection with its payload indexes unless it exists; concurrent callers are fine. */
export const ensureCollection = (
	client: QdrantClient,
	name: string,
	dimensions: number,
) =>
	Effect.gen(function* () {
		const { exists } = yield* qdrantCall("collectionExists", () =>
			client.collectionExists(name),
		);
		if (!exists) {
			yield* qdrantCall("createCollection", () =>
				client.createCollection(name, {
					vectors: {
						dense: {
							size: dimensions,
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
				}),
			).pipe(
				Effect.catchIf(
					(error) => alreadyExists(error.cause),
					() => Effect.void,
				),
			);
		}
		yield* Effect.forEach(
			payloadIndexes,
			([fieldName, fieldSchema]) =>
				qdrantCall("createPayloadIndex", () =>
					client.createPayloadIndex(name, {
						wait: true,
						field_name: fieldName,
						field_schema: fieldSchema,
					}),
				).pipe(
					Effect.catchIf(
						(error) => alreadyExists(error.cause),
						() => Effect.void,
					),
				),
			{
				discard: true,
			},
		);
	});

/** Deletes every collection named with `prefix` but `keep`. */
export const deleteCollectionsBut = (
	client: QdrantClient,
	prefix: string,
	keep: string,
) =>
	Effect.gen(function* () {
		const { collections } = yield* qdrantCall("getCollections", () =>
			client.getCollections(),
		);
		yield* Effect.forEach(
			collections.filter(
				({ name }) => name.startsWith(`${prefix}-`) && name !== keep,
			),
			({ name }) =>
				qdrantCall("deleteCollection", () => client.deleteCollection(name)),
			{
				discard: true,
			},
		);
	});

const denseSize = (vectors: unknown) => {
	const dense =
		vectors && typeof vectors === "object" && "dense" in vectors
			? (
					vectors as {
						dense?: {
							size?: unknown;
						};
					}
				).dense
			: undefined;
	return typeof dense?.size === "number" ? dense.size : undefined;
};

/** The collection's dense vector size, or null when it does not exist. */
export const collectionDimensions = (client: QdrantClient, name: string) =>
	Effect.gen(function* () {
		const { exists } = yield* qdrantCall("collectionExists", () =>
			client.collectionExists(name),
		);
		if (!exists) return null;
		const info = yield* qdrantCall("getCollection", () =>
			client.getCollection(name),
		);
		return denseSize(info.config?.params?.vectors) ?? null;
	});
