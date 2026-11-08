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
import { eq, sql } from "drizzle-orm";
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
	EmbeddingGenerationChangedError,
	EmbeddingModelChangeError,
	EmbeddingsNotConfiguredError,
	StaleEmbeddingGenerationError,
} from "./errors";
import { QdrantService } from "./service";

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
		/** One vector per search query from the generation's model, after its query prefix. */
		readonly embedQueries: (
			queries: readonly string[],
		) => Effect.Effect<number[][], AiError>;
		/** One vector per passage from the generation's model, after its passage prefix. */
		readonly embedPassages: (
			passages: readonly string[],
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
	readonly queryPrefix: string;
	readonly passagePrefix: string;
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
			queryPrefix: settings.embeddingQueryPrefix,
			passagePrefix: settings.embeddingPassagePrefix,
		})
		.from(settings);
	return row?.generation == null ? undefined : (row as StoredGeneration);
});

const snapshotOf = (stored: StoredGeneration) =>
	Effect.gen(function* () {
		const connection: EmbeddingConnection = {
			baseUrl: stored.baseUrl,
			apiKey: yield* decryptApiKey(stored.apiKeyEncrypted),
			model: stored.model,
		};
		return EmbeddingGeneration.of({
			generation: stored.generation,
			model: stored.model,
			dimensions: stored.dimensions,
			collection: stored.collection,
			embedQueries: (queries) =>
				embedValues(connection, queries, stored.queryPrefix),
			embedPassages: (passages) =>
				embedValues(connection, passages, stored.passagePrefix),
		});
	});

const lockGenerations = (exclusive: boolean) =>
	Effect.gen(function* () {
		const { collectionPrefix } = yield* EmbeddingIndex;
		const db = yield* DB;
		yield* db.execute(
			(exclusive ? advisoryXactLock : advisoryXactLockShared)(
				"embeddingGenerations",
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
					queryPrefix: stored.queryPrefix,
					passagePrefix: stored.passagePrefix,
				}
			: undefined,
	),
);

/** The stored API key, decrypted, for testing an edited endpoint with it. */
export const storedEmbeddingApiKey = readStored.pipe(
	Effect.flatMap((stored) =>
		stored ? decryptApiKey(stored.apiKeyEncrypted) : Effect.succeed(undefined),
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

type GenerationSetup = {
	readonly baseUrl: string;
	readonly apiKeyEncrypted: string;
	readonly model: string;
	readonly dimensions: number;
	readonly queryPrefix: string;
	readonly passagePrefix: string;
};

/**
 * Makes `setup` the active generation under a new number with a collection
 * of its own, whose files are re-embedded until they have all settled.
 * Needs the generation lock held exclusively.
 */
const startGeneration = (setup: GenerationSetup) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const scope = yield* EmbeddingIndex;
		const [{ generation }] = yield* db.execute<{
			generation: number;
		}>(
			sql`select nextval('embedding_generation_seq')::int as generation`,
			"objects",
		);
		const values = {
			embeddingGeneration: generation,
			embeddingBaseUrl: setup.baseUrl,
			embeddingApiKeyEncrypted: setup.apiKeyEncrypted,
			embeddingModel: setup.model,
			embeddingDimensions: setup.dimensions,
			embeddingQueryPrefix: setup.queryPrefix,
			embeddingPassagePrefix: setup.passagePrefix,
			embeddingCollection: generationCollectionName(
				scope.collectionPrefix,
				generation,
				setup.model,
				setup.dimensions,
			),
			embeddingRebuilding: true,
			updatedAt: new Date(),
		};
		const { client } = yield* QdrantService;
		yield* ensureCollection(
			client,
			values.embeddingCollection,
			setup.dimensions,
		);
		yield* db
			.insert(scope.settings)
			.values({
				id: true,
				...values,
			})
			.onConflictDoUpdate({
				target: scope.settings.id,
				set: values,
			});
		return generation;
	});

/** Runs `body` in a transaction holding the generation lock exclusively, so saves run one at a time and no point write straddles a new generation. */
const exclusively = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			lockGenerations(true).pipe(Effect.andThen(body)),
		);
	});

/**
 * Stores the endpoint the instance embeds with, with the key its test
 * embedding used. The same model, dimensions and passage prefix update the
 * active generation in place, the query prefix included. The first setup,
 * and another model, size or passage prefix when the caller confirmed
 * replacing the active generation (`reembedGeneration`), start a new
 * generation: search moves to its empty collection at once and every file
 * is embedded again. Unconfirmed, such a change fails
 * `EmbeddingModelChangeError`. Any save confirmed for a generation another
 * save has replaced since fails `EmbeddingGenerationChangedError`. Returns the active
 * generation and whether it started.
 */
export const configureEmbeddings = (
	setup: {
		readonly baseUrl: string;
		readonly apiKey: string;
		readonly model: string;
		readonly dimensions: number;
		readonly queryPrefix: string;
		readonly passagePrefix: string;
	},
	options: {
		readonly reembedGeneration?: number;
	} = {},
) =>
	exclusively(
		Effect.gen(function* () {
			const db = yield* DB;
			const { settings } = yield* EmbeddingIndex;
			const stored = yield* readStored;
			const apiKeyEncrypted = yield* encryptApiKey(setup.apiKey);
			// A confirmation for a replaced generation must not touch its successor either.
			if (
				stored &&
				options.reembedGeneration !== undefined &&
				options.reembedGeneration !== stored.generation
			) {
				return yield* new EmbeddingGenerationChangedError({
					generation: stored.generation,
				});
			}
			// Vectors stay comparable only with the same model, size and passage prefix.
			const sameVectors =
				stored?.model === setup.model &&
				stored.dimensions === setup.dimensions &&
				stored.passagePrefix === setup.passagePrefix;
			if (stored && sameVectors) {
				yield* db
					.update(settings)
					.set({
						embeddingBaseUrl: setup.baseUrl,
						embeddingApiKeyEncrypted: apiKeyEncrypted,
						embeddingQueryPrefix: setup.queryPrefix,
						updatedAt: new Date(),
					})
					.where(eq(settings.id, true));
				return {
					started: false,
					generation: stored.generation,
				};
			}
			if (stored && options.reembedGeneration === undefined) {
				return yield* new EmbeddingModelChangeError({
					model: setup.model,
					dimensions: setup.dimensions,
				});
			}
			return {
				started: true,
				generation: yield* startGeneration({
					baseUrl: setup.baseUrl,
					apiKeyEncrypted,
					model: setup.model,
					dimensions: setup.dimensions,
					queryPrefix: setup.queryPrefix,
					passagePrefix: setup.passagePrefix,
				}),
			};
		}),
	);

/**
 * Embeds every file again with the active setup, into a new generation and
 * collection, when `generation` is still the active one; a repeated request
 * finds it replaced and starts nothing. Returns whether it started one.
 */
export const reembedEmbeddings = (generation: number) =>
	exclusively(
		Effect.gen(function* () {
			const stored = yield* readStored;
			if (!stored) return yield* new EmbeddingsNotConfiguredError();
			if (stored.generation !== generation) {
				return {
					started: false,
				};
			}
			yield* startGeneration(stored);
			return {
				started: true,
			};
		}),
	);

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
