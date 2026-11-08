import { afterAll, expect, test } from "bun:test";
import { EncryptionKeyLive } from "@orcai/ai";
import { DB, DrizzleLive } from "@orcai/db";
import { awaitLockWaiters, holdLock } from "@orcai/testing";
import { QdrantClient } from "@qdrant/qdrant-js";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { browseAssetPoints } from "../src/browse";
import { defaultBm25Config } from "../src/config";
import { buildQdrantFilter, payloadKey } from "../src/filter";
import {
	activeGeneration,
	configureEmbeddings,
	EmbeddingIndex,
	type EmbeddingIndexScope,
	embeddingSettings,
	inspectActiveCollection,
	maintainCollections,
	onActiveGeneration,
	storedEmbeddingApiKey,
	writeGeneration,
} from "../src/generation";
import { QdrantLive, QdrantService } from "../src/service";
import { testEmbeddingIndex } from "./embedding-index";

const TIMEOUT = 30_000;
const DIMENSIONS = 4;

const runtime = ManagedRuntime.make(
	Layer.mergeAll(DrizzleLive, QdrantLive, EncryptionKeyLive),
);
afterAll(() => runtime.dispose());

const indexes = {
	unset: await testEmbeddingIndex(),
	partial: await testEmbeddingIndex(),
	down: await testEmbeddingIndex(),
	racing: await testEmbeddingIndex(),
	switching: await testEmbeddingIndex(),
};

const on = <A, E>(
	index: EmbeddingIndexScope,
	effect: Effect.Effect<
		A,
		E,
		ManagedRuntime.ManagedRuntime.Services<typeof runtime>
	>,
) =>
	runtime.runPromise(effect.pipe(Effect.provideService(EmbeddingIndex, index)));

const setup = (
	options: {
		readonly dimensions?: number;
		readonly reembedGeneration?: number;
	} = {},
) =>
	configureEmbeddings(
		{
			baseUrl: "http://127.0.0.1:9/v1",
			apiKey: "key",
			model: "integration",
			dimensions: options.dimensions ?? DIMENSIONS,
			queryPrefix: "",
			passagePrefix: "",
		},
		options,
	);

const save = (index: EmbeddingIndexScope) => on(index, setup());

const collectionsOf = (index: EmbeddingIndexScope) =>
	runtime.runPromise(
		QdrantService.pipe(
			Effect.flatMap(({ client }) =>
				Effect.promise(() => client.getCollections()),
			),
			Effect.map(({ collections }) =>
				collections
					.map(({ name }) => name)
					.filter((name) => name.startsWith(`${index.collectionPrefix}-`)),
			),
		),
	);

// Nothing listens on the discard port.
const unreachableQdrant = QdrantService.of({
	client: new QdrantClient({
		url: "http://127.0.0.1:9",
		port: null,
	}),
	bm25Config: defaultBm25Config,
});

test(
	"before setup nothing reads a generation, runs on one or creates a collection",
	async () => {
		const index = indexes.unset;

		expect(await on(index, activeGeneration)).toBeUndefined();
		expect(await on(index, embeddingSettings)).toBeUndefined();
		expect(await on(index, storedEmbeddingApiKey)).toBeUndefined();
		expect(await on(index, inspectActiveCollection)).toBeUndefined();
		await on(index, maintainCollections);
		for (const run of [
			onActiveGeneration(Effect.void),
			writeGeneration(Effect.void),
		]) {
			expect((await on(index, Effect.flip(run)))._tag).toBe(
				"EmbeddingsNotConfiguredError",
			);
		}
		expect(await collectionsOf(index)).toEqual([]);

		await save(index);
		expect(await on(index, activeGeneration)).toBeNumber();
		expect(await on(index, storedEmbeddingApiKey)).toBe("key");
	},
	TIMEOUT,
);

test("a partly set embedding setup is a defect, not a missing one", async () => {
	const index = indexes.partial;
	await on(
		index,
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db.execute(
				sql`alter table ${index.settings} drop constraint instance_settings_embedding_complete`,
			);
			yield* db.insert(index.settings).values({
				id: true,
				embeddingGeneration: 1,
			});
		}),
	);

	await expect(on(index, activeGeneration)).rejects.toThrow(
		"The embedding settings are only partly set",
	);
});

test(
	"a save switches generations without Qdrant, whose health inspection fails until it answers and then creates the collection",
	async () => {
		const index = indexes.down;

		expect(await save(index)).toMatchObject({
			started: true,
		});
		expect(await collectionsOf(index)).toEqual([]);

		const down = await on(
			index,
			inspectActiveCollection.pipe(
				Effect.provideService(QdrantService, unreachableQdrant),
				Effect.flip,
			),
		);
		expect(down._tag).toBe("QdrantError");

		const settings = await on(index, embeddingSettings);
		expect(await on(index, inspectActiveCollection)).toEqual({
			collection: String(settings?.collection),
			dimensions: DIMENSIONS,
			collectionDimensions: DIMENSIONS,
		});
		expect(await collectionsOf(index)).toEqual([
			String(settings?.collection),
		]);
	},
	TIMEOUT,
);

test(
	"the reconciler, a read and the health inspection creating a new generation's collection at once each find it with every index built",
	async () => {
		const index = indexes.racing;
		await save(index);
		const settings = await on(index, embeddingSettings);

		const [, page, inspection] = await on(
			index,
			Effect.all(
				[
					maintainCollections,
					onActiveGeneration(
						browseAssetPoints({
							filter: buildQdrantFilter({
								blockId: crypto.randomUUID(),
								assetIds: [
									crypto.randomUUID(),
								],
							}),
							order: "reading",
							limit: 10,
						}),
					),
					inspectActiveCollection,
				],
				{
					concurrency: "unbounded",
				},
			),
		);

		expect(page).toEqual({
			data: [],
			nextCursor: null,
		});
		expect(inspection?.collectionDimensions).toBe(DIMENSIONS);
		expect(await collectionsOf(index)).toEqual([
			String(settings?.collection),
		]);
		const { payload_schema } = await runtime.runPromise(
			QdrantService.pipe(
				Effect.flatMap(({ client }) =>
					Effect.promise(() =>
						client.getCollection(String(settings?.collection)),
					),
				),
			),
		);
		expect(Object.keys(payload_schema).sort()).toEqual(
			Object.values(payloadKey).sort(),
		);
	},
	TIMEOUT,
);

test(
	"a health inspection racing a switch inspects the new generation, and no retired collection is left",
	async () => {
		const index = indexes.switching;
		await save(index);
		const retired = await on(index, embeddingSettings);

		// The switch holds the generation lock until the test lets it commit.
		const commit = await on(
			index,
			holdLock(
				setup({
					dimensions: DIMENSIONS * 2,
					reembedGeneration: retired?.generation,
				}),
			),
		);
		const inspecting = on(index, inspectActiveCollection);
		await on(
			index,
			awaitLockWaiters({
				space: "embeddingGenerations",
				key: index.collectionPrefix,
			}),
		);
		await on(index, commit);
		await on(index, maintainCollections);

		const active = await on(index, embeddingSettings);
		expect(active?.collection).not.toBe(retired?.collection);
		expect((await inspecting)?.collection).toBe(String(active?.collection));
		expect(await collectionsOf(index)).toEqual([
			String(active?.collection),
		]);
	},
	TIMEOUT,
);
