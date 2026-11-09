import type { QdrantClient } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import z from "zod/v4";
import { qdrantCall } from "./client";
import type { QdrantError } from "./errors";
import { payloadKey } from "./filter";

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

const statusOf = (error: QdrantError) =>
	typeof error.cause === "object" &&
	error.cause !== null &&
	"status" in error.cause
		? error.cause.status
		: undefined;

/** Until another caller's create returns, its collection answers reads with 500 while its shard initialises. */
const whileAnotherCreates = Schedule.max([
	Schedule.spaced("50 millis"),
	Schedule.during("5 seconds"),
]);

const initialising = (client: QdrantClient, name: string) =>
	qdrantCall("collectionClusterInfo", () =>
		client.collectionClusterInfo(name),
	).pipe(
		Effect.map(({ local_shards }) =>
			local_shards.some(({ state }) => state === "Initializing"),
		),
	);

const payloadIndexes = [
	[
		payloadKey.assetId,
		{
			type: "uuid",
		},
	],
	[
		payloadKey.blockId,
		{
			type: "uuid",
			is_tenant: true,
		},
	],
	[
		payloadKey.chunkIndex,
		{
			type: "integer",
		},
	],
	[
		payloadKey.chunkPageStart,
		{
			type: "integer",
		},
	],
	[
		payloadKey.chunkPageEnd,
		{
			type: "integer",
		},
	],
	[
		payloadKey.published,
		{
			type: "bool",
		},
	],
	[
		payloadKey.source,
		{
			type: "keyword",
		},
	],
	// Only deleting and publishing an attempt's points filter on it, by range.
	[
		payloadKey.indexAttempt,
		{
			type: "integer",
			lookup: false,
			range: true,
			enable_hnsw: false,
		},
	],
] as const;

type PayloadIndex = (typeof payloadIndexes)[number];

const missingFrom = (schema: Record<string, unknown>) =>
	payloadIndexes.filter(([fieldName]) => !(fieldName in schema));

/**
 * Creates the collection unless it exists, and any payload index it lacks;
 * concurrent callers are fine. An empty collection has its indexes before
 * this returns, as ordered browsing needs them and they build at once. Its
 * creator queues them, and every other caller waits for those builds and
 * queues only what is still missing then. On one holding points, a missing
 * index builds in the background: filters stay correct meanwhile, only
 * slower, and no caller waits on a full collection's index.
 */
export const ensureCollection = (
	client: QdrantClient,
	name: string,
	dimensions: number,
) =>
	Effect.gen(function* () {
		const queue = (indexes: readonly PayloadIndex[]) =>
			Effect.forEach(
				indexes,
				([fieldName, fieldSchema]) =>
					qdrantCall("createPayloadIndex", () =>
						client.createPayloadIndex(name, {
							wait: false,
							field_name: fieldName,
							field_schema: fieldSchema,
						}),
					),
				{
					discard: true,
				},
			);
		// Deletes nothing: Qdrant applies a collection's updates in order, so it answers once every update queued before it is applied.
		const awaitQueued = qdrantCall("awaitPayloadIndexes", () =>
			client.delete(name, {
				wait: true,
				filter: {
					must: [
						{
							has_id: [],
						},
					],
				},
			}),
		);
		// The schema lists only applied indexes, so one another caller queued counts as missing.
		const readInfo = qdrantCall("getCollection", () =>
			client.getCollection(name),
		);

		const { exists } = yield* qdrantCall("collectionExists", () =>
			client.collectionExists(name),
		);
		const created =
			!exists &&
			(yield* qdrantCall("createCollection", () =>
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
				Effect.as(true),
				Effect.catchIf(
					(error) => statusOf(error) === 409,
					() => Effect.succeed(false),
				),
			));
		if (created) {
			yield* queue(payloadIndexes);
			return yield* awaitQueued;
		}

		const info = yield* readInfo.pipe(
			Effect.catchIf(
				(error) => statusOf(error) === 500,
				() =>
					initialising(client, name).pipe(
						Effect.repeat({
							while: (busy) => busy,
							schedule: whileAnotherCreates,
						}),
						Effect.andThen(readInfo),
					),
			),
		);
		const missing = missingFrom(info.payload_schema);
		if (missing.length === 0) return;
		if (info.points_count) return yield* queue(missing);
		// Its creator's builds are likely queued already: wait for them before building what they left out.
		yield* awaitQueued;
		const unbuilt = missingFrom((yield* readInfo).payload_schema);
		if (unbuilt.length === 0) return;
		yield* queue(unbuilt);
		yield* awaitQueued;
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

const denseVectorsSchema = z.object({
	dense: z.object({
		size: z.number(),
	}),
});

/**
 * The collection's dense vector size: "missing" when it does not exist, and
 * "incompatible" when it has no dense vector, which no write repairs.
 */
export const collectionDimensions = (client: QdrantClient, name: string) =>
	Effect.gen(function* () {
		const { exists } = yield* qdrantCall("collectionExists", () =>
			client.collectionExists(name),
		);
		if (!exists) return "missing" as const;
		const info = yield* qdrantCall("getCollection", () =>
			client.getCollection(name),
		);
		return (
			denseVectorsSchema.safeParse(info.config?.params?.vectors).data?.dense
				.size ?? ("incompatible" as const)
		);
	});
