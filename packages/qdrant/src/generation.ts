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
	isLockTimeout,
} from "@orcai/db";
import { eq, sql } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FiberMap from "effect/FiberMap";
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
import { CollectionSetups } from "./setups";

/** The instance settings table, in the instance's schema or a test's own. */
type InstanceSettingsTable = PgTableWithColumns<{
	readonly name: "instance_settings";
	readonly schema: string | undefined;
	readonly columns: (typeof dbSchema.instanceSettings)["_"]["columns"];
	readonly dialect: "pg";
	readonly isAlias: false;
}>;

/** Where the instance's embedding generations live: the settings row and the collections they name. */
export interface EmbeddingIndexScope {
	readonly settings: InstanceSettingsTable;
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
	if (!row) return undefined;
	const {
		generation,
		baseUrl,
		apiKeyEncrypted,
		model,
		dimensions,
		collection,
	} = row;
	if (
		[
			generation,
			baseUrl,
			apiKeyEncrypted,
			model,
			dimensions,
			collection,
		].every((value) => value === null)
	) {
		return undefined;
	}
	if (
		generation === null ||
		baseUrl === null ||
		apiKeyEncrypted === null ||
		model === null ||
		dimensions === null ||
		collection === null
	) {
		return yield* Effect.die(
			new Error("The embedding settings are only partly set"),
		);
	}
	return {
		...row,
		generation,
		baseUrl,
		apiKeyEncrypted,
		model,
		dimensions,
		collection,
	} satisfies StoredGeneration;
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

/** Each index's collection known to exist, by collection prefix. */
const ensured = new Map<string, string>();

/**
 * The active collection exists once anything runs on it: a new generation's
 * collection, or one a fresh Qdrant lacks, is created on first use.
 */
const ensureActiveCollection = (generation: {
	readonly collection: string;
	readonly dimensions: number;
}) =>
	Effect.gen(function* () {
		const { collectionPrefix } = yield* EmbeddingIndex;
		if (ensured.get(collectionPrefix) === generation.collection) return;
		const { client } = yield* QdrantService;
		yield* ensureCollection(
			client,
			generation.collection,
			generation.dimensions,
		);
		ensured.set(collectionPrefix, generation.collection);
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
				const generation = yield* Option.match(ambient, {
					onNone: () =>
						stored
							? snapshotOf(stored)
							: Effect.fail(new EmbeddingsNotConfiguredError()),
					onSome: (snapshot) =>
						stored?.generation === snapshot.generation
							? Effect.succeed(snapshot)
							: Effect.fail(
									new StaleEmbeddingGenerationError({
										generation: snapshot.generation,
									}),
								),
				});
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

/**
 * Sets up the active generation's collection like any use does, and reads it
 * back, under the generation lock: a replaced one is not created again, and
 * the read is of the generation it set up. Undefined before setup. A lock
 * held past `lockWait` fails it `LockTimeoutError`.
 */
export const setUpActiveCollection = (lockWait: Duration.Input) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const { collectionPrefix } = yield* EmbeddingIndex;
				yield* db.execute(
					sql`SELECT set_config('lock_timeout', ${`${Duration.toMillis(Duration.fromInputUnsafe(lockWait))}ms`}, true)`,
				);
				yield* lockGenerations(false);
				const stored = yield* readStored;
				if (!stored) return undefined;
				yield* ensureActiveCollection(stored);
				const { client } = yield* QdrantService;
				const dimensions = yield* collectionDimensions(
					client,
					stored.collection,
				);
				// Deleted since its setup, so the next use creates it again.
				if (
					dimensions === "missing" &&
					ensured.get(collectionPrefix) === stored.collection
				)
					ensured.delete(collectionPrefix);
				return {
					collection: stored.collection,
					dimensions: stored.dimensions,
					collectionDimensions: dimensions,
				};
			}),
		);
	});

/**
 * The active generation's collection as Qdrant has it, set up first; undefined
 * before setup. Callers outside a transaction join one running setup, and one
 * that outlasts `patience` keeps running while this answers "preparing". A
 * setup that waits for the generation lock longer than `lockWait`, behind a
 * save, fails, and this answers "saving".
 */
export const inspectActiveCollection = (options: {
	readonly patience: Duration.Input;
	readonly lockWait: Duration.Input;
}) =>
	Effect.gen(function* () {
		const { collectionPrefix } = yield* EmbeddingIndex;
		const setups = yield* CollectionSetups;
		const run =
			yield* FiberMap.runtime(setups)<
				Effect.Services<ReturnType<typeof setUpActiveCollection>>
			>();
		const setup = Option.getOrElse(
			FiberMap.getUnsafe(setups, collectionPrefix),
			() => run(collectionPrefix, setUpActiveCollection(options.lockWait)),
		);
		return yield* Fiber.join(setup).pipe(
			Effect.timeoutOption(options.patience),
			Effect.map(Option.getOrElse(() => "preparing" as const)),
			Effect.catchIf(isLockTimeout, () => Effect.succeed("saving" as const)),
		);
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
 * of its own, whose files are re-embedded until they have all settled. Only
 * the database changes: the collection is created on first use, so no Qdrant
 * call runs under the lock. Needs the generation lock held exclusively.
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
