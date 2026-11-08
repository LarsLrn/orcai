import { describe, expect, test } from "bun:test";
import { createTurnWrites } from "./turn-writes";

const publish = [
	"bot",
	"publish",
];

describe("createTurnWrites", () => {
	test("keeps only the procedures the Assistant writes with, and only the fields their stale queries read", () => {
		const writes = createTurnWrites();

		writes.record(
			[
				"bot",
				"find",
			],
			{
				id: "bot-1",
			},
			{},
		);
		writes.record(
			[
				"organizationMember",
				"delete",
			],
			{
				userIds: [
					"user-1",
				],
			},
			{
				handedOver: null,
			},
		);
		writes.record(publish, {}, {});
		writes.record(publish, {}, {});

		expect(writes.all()).toEqual([
			{
				path: "organizationMember.delete",
				handedOver: false,
			},
			{
				path: "bot.publish",
			},
		]);
	});

	test("waits for a running call, so its write counts", async () => {
		const writes = createTurnWrites();
		const call = Promise.withResolvers<void>();
		writes.track(call.promise.then(() => writes.record(publish, {}, {})));

		const settled = writes.settled();
		call.resolve();
		await settled;

		expect(writes.all()).toEqual([
			{
				path: "bot.publish",
			},
		]);
	});

	test("a failed call ends the wait like a finished one", async () => {
		const writes = createTurnWrites();
		writes.track(Promise.reject(new Error("connection reset")));

		await writes.settled();

		expect(writes.all()).toEqual([]);
	});

	test("stops waiting at the bound, and a call that ends later rejects nothing", async () => {
		const bound = new AbortController();
		const writes = createTurnWrites(() => bound.signal);
		const late = Promise.withResolvers<void>();
		const failing = Promise.withResolvers<void>();
		writes.track(late.promise.then(() => writes.record(publish, {}, {})));
		writes.track(failing.promise);
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);

		const settled = writes.settled();
		bound.abort();
		await settled;
		const atBound = [
			...writes.all(),
		];
		late.resolve();
		failing.reject(new Error("connection reset"));
		await new Promise((resolve) => setTimeout(resolve, 10));
		process.off("unhandledRejection", onUnhandled);

		expect(atBound).toEqual([]);
		expect(unhandled).toEqual([]);
	});
});
