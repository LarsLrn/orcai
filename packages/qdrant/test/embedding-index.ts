import { afterAll } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import type { BlockId } from "@orcai/core";
import { DB, DrizzleLive, type dbSchema } from "@orcai/db";
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

/**
 * An embedding index of the test's own: a settings table in its own schema
 * and collections under its own prefix, so a test can set embeddings up
 * without touching the instance's or another test's. Its reconciler admits
 * only links of `blockIds`. Both go when the scope closes.
 */
const isolatedEmbeddingIndex = (blockIds: readonly BlockId[] = []) =>
	Effect.acquireRelease(
		Effect.gen(function* () {
			const db = yield* DB;
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
					settings: instanceSettingsIn(
						schema,
					) as unknown as typeof dbSchema.instanceSettings,
					collectionPrefix: `orcai-test-${id}`,
					blockIds,
				} satisfies EmbeddingIndexScope,
			};
		}),
		({ schema, scope }) =>
			Effect.gen(function* () {
				const db = yield* DB;
				const { client } = yield* QdrantService;
				yield* db.execute(sql.raw(`drop schema "${schema}" cascade`));
				const { collections } = yield* Effect.promise(() =>
					client.getCollections(),
				);
				yield* Effect.forEach(
					collections.filter(({ name }) =>
						name.startsWith(`${scope.collectionPrefix}-`),
					),
					({ name }) => Effect.promise(() => client.deleteCollection(name)),
					{
						discard: true,
					},
				);
			}).pipe(Effect.orDie),
	).pipe(Effect.map(({ scope }) => scope));

/** `isolatedEmbeddingIndex` in place of the instance's, for a whole runtime. */
export const IsolatedEmbeddingIndexLive = (blockIds?: readonly BlockId[]) =>
	Layer.effect(EmbeddingIndex, isolatedEmbeddingIndex(blockIds));

/**
 * An isolated embedding index for the test file, set up with `embeddings`
 * when given, its collection created as the reconciler pass a save wakes
 * creates it; its runtime and data go after the file's last test.
 */
export const testEmbeddingIndex = async (embeddings?: {
	readonly baseUrl: string;
	readonly model: string;
	readonly dimensions: number;
	readonly queryPrefix?: string;
	readonly passagePrefix?: string;
}) => {
	const runtime = ManagedRuntime.make(
		IsolatedEmbeddingIndexLive().pipe(
			Layer.provideMerge(
				Layer.mergeAll(DrizzleLive, QdrantLive, EncryptionKeyLive),
			),
		),
	);
	afterAll(() => runtime.dispose());
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
