import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { openRequests, whenSent } from "./open-requests";

const streamed = () => {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	const body = new ReadableStream<Uint8Array>({
		start(started) {
			controller = started;
		},
	});
	return {
		response: new Response(body),
		push: (chunk: string) =>
			controller?.enqueue(new TextEncoder().encode(chunk)),
		end: () => controller?.close(),
		fail: (error: unknown) => controller?.error(error),
	};
};

const settled = async (promise: Promise<unknown>) => {
	let done = false;
	promise.then(
		() => {
			done = true;
		},
		() => {
			done = true;
		},
	);
	await new Promise((resolve) => setTimeout(resolve, 10));
	return done;
};

describe("whenSent", () => {
	test("reports once the body is read to the end", async () => {
		const stream = streamed();
		const outcomes: unknown[] = [];
		const response = whenSent(stream.response, (failure) => {
			outcomes.push(failure);
		});
		stream.push("a");
		stream.end();

		expect(await response.text()).toBe("a");
		expect(outcomes).toEqual([
			undefined,
		]);
	});

	test("passes the error of a failed body", async () => {
		const stream = streamed();
		const outcomes: unknown[] = [];
		const response = whenSent(stream.response, (failure) => {
			outcomes.push(failure);
		});
		const error = new Error("broken");
		stream.fail(error);

		await expect(response.text()).rejects.toThrow("broken");
		expect(outcomes).toEqual([
			{
				error,
			},
		]);
	});

	test("reports a cancelled body without an error", async () => {
		const stream = streamed();
		const outcomes: unknown[] = [];
		const response = whenSent(stream.response, (failure) => {
			outcomes.push(failure);
		});

		await response.body?.cancel();
		expect(outcomes).toEqual([
			undefined,
		]);
	});

	test("reports a cancel during a pending read once", async () => {
		const stream = streamed();
		const outcomes: unknown[] = [];
		const response = whenSent(stream.response, (failure) => {
			outcomes.push(failure);
		});
		const reader = response.body?.getReader();
		const read = reader?.read();
		await new Promise((resolve) => setTimeout(resolve, 10));

		await reader?.cancel();
		expect(await read).toEqual({
			done: true,
			value: undefined,
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(outcomes).toEqual([
			undefined,
		]);
	});

	test("reports a response without a body at once", () => {
		const outcomes: unknown[] = [];
		whenSent(
			new Response(null, {
				status: 204,
			}),
			(failure) => {
				outcomes.push(failure);
			},
		);
		expect(outcomes).toEqual([
			undefined,
		]);
	});
});

describe("openRequests", () => {
	test("drains at once without open requests", async () => {
		const requests = openRequests();
		expect(await settled(Effect.runPromise(requests.drained))).toBe(true);
	});

	test("drains only after a streamed response is sent", async () => {
		const requests = openRequests();
		const stream = streamed();
		const response = await requests.track(async () => stream.response);

		const drained = Effect.runPromise(requests.drained);
		stream.push("a");
		expect(await settled(drained)).toBe(false);

		stream.end();
		await response.text();
		expect(await settled(drained)).toBe(true);
	});

	test("waits for requests that arrive while draining", async () => {
		const requests = openRequests();
		const first = streamed();
		const second = streamed();
		const firstResponse = await requests.track(async () => first.response);

		const drained = Effect.runPromise(requests.drained);
		const secondResponse = await requests.track(async () => second.response);
		first.end();
		await firstResponse.text();
		expect(await settled(drained)).toBe(false);

		second.end();
		await secondResponse.text();
		expect(await settled(drained)).toBe(true);
	});

	test("closes a request whose handler throws", async () => {
		const requests = openRequests();
		await expect(
			requests.track(() => Promise.reject(new Error("handler failed"))),
		).rejects.toThrow("handler failed");
		expect(await settled(Effect.runPromise(requests.drained))).toBe(true);
	});
});
