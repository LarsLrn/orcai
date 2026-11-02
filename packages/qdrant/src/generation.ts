import { PgClient } from "@effect/sql-pg";
import {
	type AiError,
	decryptApiKey,
	type EmbeddingConnection,
	embedValues,
	encryptApiKey,
} from "@orcai/ai";
import type { BlockId } from "@orcai/core";
import {
	advisoryXactLock,
	advisoryXactLockShared,
	DB,
	dbSchema,
} from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import {
	collectionDimensions,
	deleteCollectionsBut,
	ensureCollection,
	generationCollectionName,
} from "./collections";
import {
	EmbeddingModelChangeError,
	EmbeddingsNotConfiguredError,
	StaleEmbeddingGenerationError,
} from "./errors";
import { QdrantService } from "./service";

const GENERATION_LOCK_SPACE = 51830478;

/** Where the instance's embedding generations live: the settings row and the collections they name. */
export interface EmbeddingIndexScope {
	readonly settings: typeof dbSchema.instanceSettings;
	readonly collectionPrefix: string;
	/** The repositories whose links it indexes; every repository without. */
	readonly blockIds?: readonly BlockId[];
}

/** The instance's embedding index; tests swap in an isolated one. */
export const EmbeddingIndex = Context.Reference<EmbeddingIndexScope>(
	"EmbeddingIndex",
	{
		defaultValue: () => ({
			settings: dbSchema.instanceSettings,
			collectionPrefix: "orcai-chunks",
		}),
	},
);

/** The generation an operation runs on, unchanged however long it takes. */
export class EmbeddingGeneration extends Context.Service<
	EmbeddingGeneration,
	{
		readonly generation: number;
		readonly model: string;
		readonly dimensions: number;
		readonly collection: string;
		/** One vector per value from the generation's model. */
		readonly embed: (
			values: readonly string[],
		) => Effect.Effect<number[][], AiError>;
	}
>()("EmbeddingGeneration") {}

/** Proof that point writes run while their generation is active; only `writeGeneration` provides it. */
export class GenerationWrite extends Context.Service<
	GenerationWrite,
	{
		readonly collection: string;
	}
>()("GenerationWrite") {}

type StoredGeneration = {
	readonly generation: number;
	readonly baseUrl: string;
	readonly apiKeyEncrypted: string;
	readonly model: string;
	readonly dimensions: number;
	readonly collection: string;
};

const readStored = Effect.gen(function* () {
	const { settings } = yield* EmbeddingIndex;
	const db = yield* DB;
	const [row] = yield* db
		.select({
			generation: settings.embeddingGeneration,
			baseUrl: settings.embeddingBaseUrl,
			apiKeyEncrypted: settings.embeddingApiKeyEncrypted,
			model: settings.embeddingModel,
			dimensions: settings.embeddingDimensions,
			collection: settings.embeddingCollection,
		})
		.from(settings);
	return row?.generation == null ? undefined : (row as StoredGeneration);
});

const apiKeys = new Map<string, string>();

/** Decrypting costs a key derivation, so each stored key is decrypted once per process. */
const storedKey = (encrypted: string) => {
	const known = apiKeys.get(encrypted);
	return known === undefined
		? decryptApiKey(encrypted).pipe(
				Effect.tap((apiKey) =>
					Effect.sync(() => apiKeys.set(encrypted, apiKey)),
				),
			)
		: Effect.succeed(known);
};

const snapshotOf = (stored: StoredGeneration) =>
	Effect.gen(function* () {
		const connection: EmbeddingConnection = {
			baseUrl: stored.baseUrl,
			apiKey: yield* storedKey(stored.apiKeyEncrypted),
			model: stored.model,
		};
		return EmbeddingGeneration.of({
			generation: stored.generation,
			model: stored.model,
			dimensions: stored.dimensions,
			collection: stored.collection,
			embed: (values) => embedValues(connection, values),
		});
	});

const lockGenerations = (exclusive: boolean) =>
	Effect.gen(function* () {
		const { collectionPrefix } = yield* EmbeddingIndex;
		const db = yield* DB;
		yield* db.execute(
			(exclusive ? advisoryXactLock : advisoryXactLockShared)(
				GENERATION_LOCK_SPACE,
				collectionPrefix,
			),
		);
	});

const ensured = new Set<string>();

/** The active collection exists once anything runs on it: a fresh Qdrant gets it on first use. */
const ensureActiveCollection = (generation: EmbeddingGeneration["Service"]) =>
	Effect.gen(function* () {
		if (ensured.has(generation.collection)) return;
		const { client } = yield* QdrantService;
		yield* ensureCollection(
			client,
			generation.collection,
			generation.dimensions,
		);
		ensured.add(generation.collection);
	});

/**
 * Runs `body` in a transaction holding the generation lock shared, so no
 * switch lands while it writes points. The generation `body` runs on must
 * still be active, else it fails `StaleEmbeddingGenerationError`; outside one
 * it runs on the active generation. Point writes need it.
 */
export const writeGeneration = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const ambient = yield* Effect.serviceOption(EmbeddingGeneration);
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* lockGenerations(false);
				const stored = yield* readStored;
				if (Option.isSome(ambient)) {
					if (stored?.generation !== ambient.value.generation) {
						return yield* new StaleEmbeddingGenerationError({
							generation: ambient.value.generation,
						});
					}
				} else if (!stored) {
					return yield* new EmbeddingsNotConfiguredError();
				}
				const generation = Option.isSome(ambient)
					? ambient.value
					: yield* snapshotOf(stored as StoredGeneration);
				yield* ensureActiveCollection(generation);
				return yield* body.pipe(
					Effect.provideService(GenerationWrite, {
						collection: generation.collection,
					}),
					Effect.provideService(EmbeddingGeneration, generation),
				);
			}),
		);
	});

const runOn = <A, E, R>(
	stored: StoredGeneration,
	body: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const generation = yield* snapshotOf(stored);
		yield* writeGeneration(Effect.void).pipe(
			Effect.provideService(EmbeddingGeneration, generation),
			Effect.catchTag("StaleEmbeddingGenerationError", () => Effect.void),
		);
		return yield* body.pipe(
			Effect.provideService(EmbeddingGeneration, generation),
		);
	});

/**
 * Runs `body` on a snapshot of the active generation, whose model and
 * collection it uses throughout. When `body` fails after a newer generation
 * became active, it runs once more on that one. Fails
 * `EmbeddingsNotConfiguredError` while embeddings are not set up.
 */
export const onActiveGeneration = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const stored = yield* readStored;
		if (!stored) return yield* new EmbeddingsNotConfiguredError();
		return yield* runOn(stored, body).pipe(
			Effect.catch((error) =>
				readStored.pipe(
					Effect.flatMap((current) =>
						current && current.generation !== stored.generation
							? runOn(current, body)
							: Effect.fail(error),
					),
				),
			),
		);
	});

/** The active generation's number; undefined before setup. */
export const activeGeneration = readStored.pipe(
	Effect.map((stored) => stored?.generation),
);

/** The embedding setup as stored, without its key. */
export const embeddingSettings = readStored.pipe(
	Effect.map((stored) =>
		stored
			? {
					generation: stored.generation,
					baseUrl: stored.baseUrl,
					model: stored.model,
					dimensions: stored.dimensions,
					collection: stored.collection,
				}
			: undefined,
	),
);

/** The stored API key, decrypted, for testing an edited endpoint with it. */
export const storedEmbeddingApiKey = readStored.pipe(
	Effect.flatMap((stored) =>
		stored ? storedKey(stored.apiKeyEncrypted) : Effect.succeed(undefined),
	),
);

/** The active generation's collection as Qdrant has it. */
export const inspectActiveCollection = Effect.gen(function* () {
	const stored = yield* readStored;
	if (!stored) return undefined;
	const { client } = yield* QdrantService;
	return {
		collection: stored.collection,
		dimensions: stored.dimensions,
		collectionDimensions: yield* collectionDimensions(
			client,
			stored.collection,
		),
	};
});

/**
 * Stores the endpoint the instance embeds with, with the key its test
 * embedding used. The first setup starts a generation with its own
 * collection; the same model and dimensions update the active generation in
 * place. Another model or size fails `EmbeddingModelChangeError`. Holds the
 * generation lock exclusively, so saves run one at a time and no point write
 * straddles a new generation. Returns whether it started one.
 */
export const configureEmbeddings = (setup: {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly model: string;
	readonly dimensions: number;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const scope = yield* EmbeddingIndex;
		const { settings } = scope;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				yield* lockGenerations(true);
				const stored = yield* readStored;
				const apiKeyEncrypted = yield* encryptApiKey(setup.apiKey);
				if (stored) {
					if (
						stored.model !== setup.model ||
						stored.dimensions !== setup.dimensions
					) {
						return yield* new EmbeddingModelChangeError({
							model: setup.model,
							dimensions: setup.dimensions,
						});
					}
					yield* db
						.update(settings)
						.set({
							embeddingBaseUrl: setup.baseUrl,
							embeddingApiKeyEncrypted: apiKeyEncrypted,
							updatedAt: new Date(),
						})
						.where(eq(settings.id, true));
					return {
						started: false,
					};
				}
				const pg = yield* PgClient.PgClient;
				const [{ generation }] = yield* pg<{
					generation: number;
				}>`select nextval('embedding_generation_seq')::int as generation`;
				const values = {
					embeddingGeneration: generation,
					embeddingBaseUrl: setup.baseUrl,
					embeddingApiKeyEncrypted: apiKeyEncrypted,
					embeddingModel: setup.model,
					embeddingDimensions: setup.dimensions,
					embeddingCollection: generationCollectionName(
						scope.collectionPrefix,
						generation,
						setup.model,
						setup.dimensions,
					),
					updatedAt: new Date(),
				};
				const { client } = yield* QdrantService;
				yield* ensureCollection(
					client,
					values.embeddingCollection,
					setup.dimensions,
				);
				yield* db
					.insert(settings)
					.values({
						id: true,
						...values,
					})
					.onConflictDoUpdate({
						target: settings.id,
						set: values,
					});
				return {
					started: true,
				};
			}),
		);
	});

/**
 * Keeps Qdrant on the active generation: its collection exists, every other
 * collection of the index is gone. Idempotent; does nothing before setup.
 */
export const maintainCollections = writeGeneration(
	Effect.gen(function* () {
		const { collection, dimensions } = yield* EmbeddingGeneration;
		const { collectionPrefix } = yield* EmbeddingIndex;
		const { client } = yield* QdrantService;
		yield* ensureCollection(client, collection, dimensions);
		yield* deleteCollectionsBut(client, collectionPrefix, collection);
	}),
).pipe(Effect.catchTag("EmbeddingsNotConfiguredError", () => Effect.void));
