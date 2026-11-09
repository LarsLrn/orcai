import { describe, expect, test } from "bun:test";
import type { QdrantClient } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import { collectionDimensions, ensureCollection } from "../src/collections";
import { payloadKey } from "../src/filter";

const serverError = Object.assign(new Error("Internal Server Error"), {
	status: 500,
});

/**
 * An existing collection whose reads fail with 500 `failingReads` times while
 * its shard reports `shardStates` in turn, then answer with every index.
 */
const clientWith = (failingReads: number, shardStates: string[]) => {
	const calls = {
		reads: 0,
		shardChecks: 0,
	};
	const client = {
		collectionExists: async () => ({
			exists: true,
		}),
		getCollection: () => {
			calls.reads++;
			if (calls.reads <= failingReads) return Promise.reject(serverError);
			return Promise.resolve({
				points_count: 0,
				payload_schema: Object.fromEntries(
					Object.values(payloadKey).map((key) => [
						key,
						{},
					]),
				),
			});
		},
		collectionClusterInfo: () => {
			const state =
				shardStates[Math.min(calls.shardChecks, shardStates.length - 1)];
			calls.shardChecks++;
			return Promise.resolve({
				local_shards: [
					{
						state,
					},
				],
			});
		},
	} as unknown as QdrantClient;
	return {
		client,
		calls,
	};
};

describe("ensureCollection", () => {
	test("waits out another caller's create while its shard initialises", async () => {
		const { client, calls } = clientWith(1, [
			"Initializing",
			"Initializing",
			"Active",
		]);

		await Effect.runPromise(ensureCollection(client, "creating", 2));

		expect(calls).toEqual({
			reads: 2,
			shardChecks: 3,
		});
	});

	test("fails at once when a collection with active shards answers 500", async () => {
		const { client, calls } = clientWith(Number.POSITIVE_INFINITY, [
			"Active",
		]);

		const error = await Effect.runPromise(
			Effect.flip(ensureCollection(client, "broken", 2)),
		);

		expect(error).toMatchObject({
			_tag: "QdrantError",
			operation: "getCollection",
		});
		expect(calls).toEqual({
			reads: 2,
			shardChecks: 1,
		});
	});

	/**
	 * An empty collection whose updates apply in order like Qdrant's: an index
	 * name builds that index, anything else is a write. It exists with
	 * `pending` updates ahead, or with `exists: false` this caller creates it,
	 * or another caller does first when `conflict` is set.
	 */
	const queueingClient = ({
		exists = true,
		conflict = false,
		pending = [],
	}: {
		readonly exists?: boolean;
		readonly conflict?: boolean;
		readonly pending?: readonly string[];
	}) => {
		const applied = new Set<string>();
		const queue = [
			...pending,
		];
		const queued: string[] = [];
		const calls = {
			reads: 0,
		};
		const client = {
			collectionExists: async () => ({
				exists,
			}),
			createCollection: () =>
				conflict
					? Promise.reject(
							Object.assign(new Error("Conflict"), {
								status: 409,
							}),
						)
					: Promise.resolve(true),
			getCollection: () => {
				calls.reads++;
				return Promise.resolve({
					points_count: 0,
					payload_schema: Object.fromEntries(
						[
							...applied,
						].map((key) => [
							key,
							{},
						]),
					),
				});
			},
			createPayloadIndex: (
				_: string,
				{
					field_name,
				}: {
					field_name: string;
				},
			) => {
				queued.push(field_name);
				queue.push(field_name);
				return Promise.resolve();
			},
			delete: () => {
				for (const update of queue.splice(0)) {
					if (update !== "write") applied.add(update);
				}
				return Promise.resolve();
			},
		} as unknown as QdrantClient;
		return {
			client,
			applied,
			queued,
			calls,
		};
	};

	const everyIndex: string[] = Object.values(payloadKey);

	test.each([
		[
			"it creates",
			{
				exists: false,
			},
			everyIndex.length,
		],
		[
			"another caller created with its builds pending",
			{
				exists: false,
				conflict: true,
				pending: everyIndex,
			},
			0,
		],
		[
			"it exists with nothing pending",
			{},
			everyIndex.length,
		],
		[
			"it exists with only writes pending",
			{
				pending: [
					"write",
				],
			},
			everyIndex.length,
		],
	])(
		"returns with every index of an empty collection built when %s, queuing only what nobody queued",
		async (_, collection, queuedCount) => {
			const { client, applied, queued } = queueingClient(collection);

			await Effect.runPromise(ensureCollection(client, "empty", 2));

			expect(applied).toEqual(new Set(everyIndex));
			expect(queued).toHaveLength(queuedCount);
		},
	);

	test("its creator queues the indexes without reading the collection first", async () => {
		const { client, calls } = queueingClient({
			exists: false,
		});

		await Effect.runPromise(ensureCollection(client, "new", 2));

		expect(calls.reads).toBe(0);
	});
});

describe("collectionDimensions", () => {
	const clientFor = (vectors?: unknown) =>
		({
			collectionExists: async () => ({
				exists: vectors !== undefined,
			}),
			getCollection: async () => ({
				config: {
					params: {
						vectors,
					},
				},
			}),
		}) as unknown as QdrantClient;

	test("reads the dense vector size, missing without a collection and incompatible without a dense vector", async () => {
		const dimensionsOf = (vectors?: unknown) =>
			Effect.runPromise(collectionDimensions(clientFor(vectors), "c"));

		expect(
			await dimensionsOf({
				dense: {
					size: 768,
					distance: "Cosine",
				},
			}),
		).toBe(768);
		expect(await dimensionsOf()).toBe("missing");
		expect(
			await dimensionsOf({
				size: 768,
				distance: "Cosine",
			}),
		).toBe("incompatible");
	});
});
