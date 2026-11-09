import { afterAll } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import type { BlockId } from "@orcai/core";
import { DB, DrizzleLive } from "@orcai/db";
import { instanceSettingsIn } from "@orcai/db/schema";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
	configureEmbeddings,
	EmbeddingIndex,
	type EmbeddingIndexScope,
	maintainCollections,
	QdrantLive,
	QdrantService,
} from "../src";

const isolatedCollection = /^orcai-test-([0-9a-f]{32})-/;

/**
 * Deletes the collections of isolated indexes whose schema is gone, so no
 * test teardown waits on Qdrant.
 */
const deleteReleasedCollections = Effect.gen(function* () {
	const db = yield* DB;
	const { client } = yield* QdrantService;
	const { collections } = yield* Effect.promise(() => client.getCollections());
	const live = new Set(
		(yield* db.execute<{
			schema: string;
		}>(
			sql`select schema_name as schema from information_schema.schemata where starts_with(schema_name, 'embedding_test_')`,
			"objects",
		)).map(({ schema }) => schema),
	);
	yield* Effect.forEach(
		collections.filter(({ name }) => {
			const id = isolatedCollection.exec(name)?.[1];
			return id !== undefined && !live.has(`embedding_test_${id}`);
		}),
		({ name }) => Effect.promise(() => client.deleteCollection(name)),
		{
			discard: true,
		},
	);
});

/**
 * An embedding index of the test's own: a settings table in its own schema
 * and collections under its own prefix, so a test can set embeddings up
 * without touching the instance's or another test's. Its reconciler admits
 * only links of `blockIds`. The schema goes when the scope closes, its
 * collections when the next isolated index starts.
 */
const isolatedEmbeddingIndex = (blockIds: readonly BlockId[] = []) =>
	Effect.acquireRelease(
		Effect.gen(function* () {
			const db = yield* DB;
			yield* deleteReleasedCollections;
			const id = crypto.randomUUID().replaceAll("-", "");
			const schema = `embedding_test_${id}`;
			yield* db.execute(sql.raw(`create schema "${schema}"`));
			yield* db.execute(
				sql.raw(
					`create table "${schema}".instance_settings (like public.instance_settings including all)`,
				),
			);
			return {
				schema,
				scope: {
					settings: instanceSettingsIn(schema),
					collectionPrefix: `orcai-test-${id}`,
					blockIds,
				} satisfies EmbeddingIndexScope,
			};
		}),
		({ schema }) =>
			DB.pipe(
				Effect.flatMap((db) =>
					db.execute(sql.raw(`drop schema "${schema}" cascade`)),
				),
				Effect.orDie,
			),
	).pipe(Effect.map(({ scope }) => scope));

/** `isolatedEmbeddingIndex` in place of the instance's, for a whole runtime. */
export const IsolatedEmbeddingIndexLive = (blockIds?: readonly BlockId[]) =>
	Layer.effect(EmbeddingIndex, isolatedEmbeddingIndex(blockIds));

/** A runtime over an isolated index, disposed after the file's last test. */
const isolatedRuntime = () => {
	const runtime = ManagedRuntime.make(
		IsolatedEmbeddingIndexLive().pipe(
			Layer.provideMerge(
				Layer.mergeAll(DrizzleLive, QdrantLive, EncryptionKeyLive),
			),
		),
	);
	afterAll(() => runtime.dispose());
	return runtime;
};

/**
 * An isolated embedding index for the test file, set up with `embeddings`
 * when given, its collection created as the reconciler pass a save wakes
 * creates it; its runtime and schema go after the file's last test.
 */
export const testEmbeddingIndex = async (embeddings?: {
	readonly baseUrl: string;
	readonly model: string;
	readonly dimensions: number;
	readonly queryPrefix?: string;
	readonly passagePrefix?: string;
}) => {
	const runtime = isolatedRuntime();
	if (embeddings) {
		await runtime.runPromise(
			configureEmbeddings({
				queryPrefix: "",
				passagePrefix: "",
				...embeddings,
				apiKey: "key",
			}).pipe(Effect.andThen(maintainCollections)),
		);
	}
	return runtime.runPromise(EmbeddingIndex);
};

/**
 * An isolated embedding index for the test file on `index`'s generation and
 * collection: its settings start as a copy of `index`'s and then stay its
 * own, and no collection is created for it. It must not start a generation.
 */
export const testEmbeddingIndexOn = (index: EmbeddingIndexScope) =>
	isolatedRuntime().runPromise(
		Effect.gen(function* () {
			const own = yield* EmbeddingIndex;
			const db = yield* DB;
			yield* db
				.insert(own.settings)
				.values(yield* db.select().from(index.settings));
			return {
				...own,
				collectionPrefix: index.collectionPrefix,
			};
		}),
	);
