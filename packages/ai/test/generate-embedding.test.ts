import { afterEach, describe, expect, test } from "bun:test";
import { type Server, serve, sleep } from "bun";
import * as Effect from "effect/Effect";
import { embedValues } from "../src/generate-embedding";

const PER_ITEM_MS = 0.05;
const DEADLINE_MS = 10;
const CAPACITY = 2;

const servers: Server<undefined>[] = [];

afterEach(() => {
	for (const server of servers.splice(0)) server.stop(true);
});

/**
 * An embeddings endpoint that is slow per item, gives up on a call past its
 * deadline and rate-limits calls beyond its capacity or its first `refusals`.
 */
const slowEndpoint = ({ refusals = 0 }: { refusals?: number } = {}) => {
	let open = 0;
	let served = 0;
	let refused = 0;
	const stats = {
		peak: 0,
	};
	const server = serve({
		port: 0,
		async fetch(request) {
			open++;
			stats.peak = Math.max(stats.peak, open);
			try {
				const { input } = (await request.json()) as {
					input: string[];
				};
				if (refused < refusals || served >= CAPACITY) {
					refused++;
					return Response.json(
						{
							error: {
								message:
									"Rate limit exceeded: user 10s request limit reached (10 of 10)",
							},
						},
						{
							status: 429,
							headers: {
								"retry-after-ms": "1",
							},
						},
					);
				}
				if (input.length * PER_ITEM_MS > DEADLINE_MS) {
					return new Response("upstream timed out", {
						status: 504,
					});
				}
				served++;
				await sleep(input.length * PER_ITEM_MS);
				served--;
				return Response.json({
					object: "list",
					model: "fake",
					data: input.map((value, index) => ({
						object: "embedding",
						index,
						embedding: [
							Number.parseInt(value, 10),
						],
					})),
					usage: {
						prompt_tokens: input.length,
						total_tokens: input.length,
					},
				});
			} finally {
				open--;
			}
		},
	});
	servers.push(server);
	return {
		stats,
		connection: {
			baseUrl: server.url.href,
			apiKey: "key",
			model: "fake",
		},
	};
};

describe("embedValues", () => {
	test("embeds a large document through a slow endpoint without exceeding its capacity", async () => {
		const { connection, stats } = slowEndpoint();
		const values = Array.from(
			{
				length: 1000,
			},
			(_, index) => String(index).padEnd(1000, "."),
		);

		const vectors = await Effect.runPromise(embedValues(connection, values));

		expect(vectors).toEqual(
			values.map((_, index) => [
				index,
			]),
		);
		expect(stats.peak).toBeLessThanOrEqual(CAPACITY);
	});

	test("waits out a rate limit", async () => {
		const { connection } = slowEndpoint({
			refusals: 4,
		});

		const vectors = await Effect.runPromise(
			embedValues(connection, [
				"0",
				"1",
			]),
		);

		expect(vectors).toEqual([
			[
				0,
			],
			[
				1,
			],
		]);
	});

	test("embeds each value exactly as given after the prefix", async () => {
		const received: string[] = [];
		const server = serve({
			port: 0,
			async fetch(request) {
				const { input } = (await request.json()) as {
					input: string[];
				};
				received.push(...input);
				return Response.json({
					object: "list",
					model: "fake",
					data: input.map((_, index) => ({
						object: "embedding",
						index,
						embedding: [
							0.5,
						],
					})),
					usage: {
						prompt_tokens: input.length,
						total_tokens: input.length,
					},
				});
			},
		});
		servers.push(server);
		const values = [
			"C:\\new\\notes",
			"line one\nline two",
		];

		await Effect.runPromise(
			embedValues(
				{
					baseUrl: server.url.href,
					apiKey: "key",
					model: "fake",
				},
				values,
				"query: ",
			),
		);

		expect(received).toEqual(values.map((value) => `query: ${value}`));
	});
});
