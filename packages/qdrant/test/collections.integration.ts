import { afterAll, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { ensureCollection } from "../src/collections";
import { QdrantLive, QdrantService } from "../src/service";
import { SETUP_TIMEOUT } from "./test-collection";

const runtime = ManagedRuntime.make(QdrantLive);
const collection = `orcai-test-${crypto.randomUUID()}`;

afterAll(async () => {
	await runtime.runPromise(
		QdrantService.pipe(
			Effect.flatMap(({ client }) =>
				Effect.promise(() => client.deleteCollection(collection)),
			),
		),
	);
	await runtime.dispose();
});

test(
	"ensureCollection adds the payload indexes an existing collection lacks, in the background",
	async () => {
		const client = await runtime.runPromise(
			Effect.gen(function* () {
				const { client } = yield* QdrantService;
				yield* Effect.promise(() =>
					client.createCollection(collection, {
						vectors: {
							dense: {
								size: 2,
								distance: "Cosine",
							},
						},
					}),
				);
				yield* ensureCollection(client, collection, 2);
				return client;
			}),
		);
		let schema = (await client.getCollection(collection)).payload_schema;
		while (!schema.index_attempt) {
			await sleep(50);
			schema = (await client.getCollection(collection)).payload_schema;
		}

		expect(schema.index_attempt?.data_type).toBe("integer");
		expect(schema.asset_id?.data_type).toBe("uuid");
	},
	SETUP_TIMEOUT,
);
