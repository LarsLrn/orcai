import { afterAll, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { QdrantClient } from "@qdrant/qdrant-js";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { ensureCollection } from "../src/collections";
import { QdrantLive, QdrantService } from "../src/service";
import { SETUP_TIMEOUT } from "./test-collection";

const runtime = ManagedRuntime.make(QdrantLive);
afterAll(() => runtime.dispose());

// One segment: each payload index builds once per segment.
const create = (client: QdrantClient, name: string) =>
	client.createCollection(name, {
		vectors: {
			dense: {
				size: 2,
				distance: "Cosine",
			},
		},
		optimizers_config: {
			default_segment_number: 1,
		},
	});

test(
	"ensureCollection adds the payload indexes an existing collection holding points lacks, in the background",
	async () => {
		const { client } = await runtime.runPromise(QdrantService);
		const collection = `orcai-test-${crypto.randomUUID()}`;
		try {
			await create(client, collection);
			await client.upsert(collection, {
				wait: true,
				points: [
					{
						id: crypto.randomUUID(),
						vector: {
							dense: [
								1,
								0,
							],
						},
					},
				],
			});
			await runtime.runPromise(ensureCollection(client, collection, 2));
			let schema = (await client.getCollection(collection)).payload_schema;
			while (!schema.index_attempt) {
				await sleep(50);
				schema = (await client.getCollection(collection)).payload_schema;
			}

			expect(schema.index_attempt?.data_type).toBe("integer");
			expect(schema.asset_id?.data_type).toBe("uuid");
		} finally {
			await client.deleteCollection(collection);
		}
	},
	SETUP_TIMEOUT,
);
