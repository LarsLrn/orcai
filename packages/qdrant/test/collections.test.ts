import { describe, expect, test } from "bun:test";
import type { QdrantClient } from "@qdrant/qdrant-js";
import * as Effect from "effect/Effect";
import { ensureCollection } from "../src/collections";

/** A client whose collection exists when `exists`, recording each index request's `wait`. */
const clientWith = (exists: boolean) => {
	const waits: (boolean | undefined)[] = [];
	const client = {
		collectionExists: async () => ({
			exists,
		}),
		createCollection: async () => true,
		createPayloadIndex: (
			_name: string,
			request: {
				wait?: boolean;
			},
		) => {
			waits.push(request.wait);
			return Promise.resolve({
				operation_id: 0,
				status: "acknowledged",
			});
		},
	} as unknown as QdrantClient;
	return {
		client,
		waits,
	};
};

describe("ensureCollection", () => {
	test("waits for a new collection's indexes", async () => {
		const { client, waits } = clientWith(false);
		await Effect.runPromise(ensureCollection(client, "new", 2));
		expect(waits.length).toBeGreaterThan(0);
		expect(new Set(waits)).toEqual(
			new Set([
				true,
			]),
		);
	});

	test("does not wait for an existing collection's indexes", async () => {
		const { client, waits } = clientWith(true);
		await Effect.runPromise(ensureCollection(client, "existing", 2));
		expect(waits.length).toBeGreaterThan(0);
		expect(new Set(waits)).toEqual(
			new Set([
				false,
			]),
		);
	});
});
