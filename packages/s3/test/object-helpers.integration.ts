import { describe, expect, test } from "bun:test";
import { buckets } from "@orcai/core";
import * as Effect from "effect/Effect";
import {
	deletePrefixRecursively,
	listObjects,
	S3Live,
	sendDeleteObjectCommand,
	sendPutObjectCommand,
} from "../src/server";

describe("deletePrefixRecursively", () => {
	test("deletes every object under a prefix that spans several listing pages", async () => {
		const prefix = `object-helpers-test/${crypto.randomUUID()}/`;
		const sibling = `${prefix.slice(0, -1)}-sibling.txt`;
		const put = (key: string) =>
			sendPutObjectCommand({
				bucket: buckets.main.name,
				key,
				body: "x",
				contentType: "text/plain",
			});

		const outcome = await Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.forEach(
					[
						sibling,
						...Array.from(
							{
								length: 1_005,
							},
							(_, index) => `${prefix}${index}.txt`,
						),
					],
					put,
					{
						concurrency: 20,
						discard: true,
					},
				);

				yield* deletePrefixRecursively({
					bucket: buckets.main.name,
					prefix,
				});

				const listed = (search: string) =>
					listObjects({
						bucket: buckets.main.name,
						prefix: search,
					}).pipe(Effect.map((objects) => objects.map((object) => object.Key)));
				const outcome = {
					under: yield* listed(prefix),
					sibling: yield* listed(sibling),
				};
				yield* Effect.forEach(outcome.sibling, (key) =>
					key
						? sendDeleteObjectCommand({
								bucket: buckets.main.name,
								key,
							})
						: Effect.void,
				);
				return outcome;
			}).pipe(Effect.provide(S3Live)),
		);

		expect(outcome).toEqual({
			under: [],
			sibling: [
				sibling,
			],
		});
	}, 120_000);
});
