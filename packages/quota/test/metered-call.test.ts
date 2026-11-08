import { beforeEach, describe, expect, test } from "bun:test";
import type { ModelId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Logger from "effect/Logger";
import type { QuotaReservations } from "../src/enforcement";
import { type MeteredCallOutcome, startMeteredCall } from "../src/metered-call";
import { quota, withQuotaServices } from "./fake";

const start = (maxRequests = 5) =>
	startMeteredCall({
		appRequestId: "request-1",
		organizationId: "org-1" as OrganizationId,
		userId: "user-1" as UserId,
		providerId: "provider-1" as ProviderId,
		modelId: "model-1" as ModelId,
		maxRequests,
		maxOutputTokens: 512,
		inputTokens: 100,
	});

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runPromise(effect);

/** Runs `effect` with the quota fakes and returns what it logged. */
const logging = async <A, E>(
	effect: Effect.Effect<A, E, QuotaReservations>,
) => {
	const logged: unknown[] = [];
	await run(
		withQuotaServices(effect).pipe(
			Effect.provide(
				Logger.layer([
					Logger.make(({ message }) => {
						logged.push(message);
					}),
				]),
			),
		),
	);
	return logged.flat();
};

const step = (outputTokens: number) => ({
	outputTokens,
	totalTokens: outputTokens,
});

beforeEach(() => {
	quota.reset();
});

describe("startMeteredCall", () => {
	test("a request reservation smaller than asked grants fewer requests", async () => {
		quota.reservation = {
			meteringMode: "requests",
			reservedAmount: 2,
		};

		const call = await run(withQuotaServices(start(5)));
		await run(call.record(step(1)));
		expect(call.spent()).toBe(false);
		await run(call.record(step(1)));

		expect(call.maxRequests).toBe(2);
		expect(call.spent()).toBe(true);
	});

	test("a token reservation grants the requests asked for", async () => {
		quota.reservation = {
			meteringMode: "tokens",
			reservedAmount: 10_000,
		};

		const call = await run(withQuotaServices(start(25)));

		expect(call.maxRequests).toBe(25);
		expect(quota.calls.reserve[0]).toMatchObject({
			maxOutputTokens: 512,
			inputTokens: 100,
		});
	});

	test.each([
		"QUOTA_POOL_UNAVAILABLE",
		"QUOTA_EXHAUSTED",
	] as const)("a %s denial fails before the call runs", async (reason) => {
		quota.reservation = {
			denial: reason,
		};

		expect(await run(Effect.flip(withQuotaServices(start())))).toMatchObject({
			_tag: "QuotaDeniedError",
			reason,
		});
	});

	test("a quota that cannot be read fails as unavailable", async () => {
		quota.reservation = {
			unavailable: true,
		};

		expect(await run(Effect.flip(withQuotaServices(start())))).toMatchObject({
			_tag: "QuotaUnavailableError",
		});
	});

	test("each record stores every finished step so far", async () => {
		const call = await run(withQuotaServices(start()));

		await run(call.record(step(10)));
		await run(call.record(step(20)));

		expect(quota.calls.record.map(({ steps }) => steps)).toEqual([
			[
				step(10),
			],
			[
				step(10),
				step(20),
			],
		]);
	});

	test.each([
		"completed",
		"failed",
		"cancelled",
		"unused",
	] as const)("a %s call is charged its finished steps", async (outcome) => {
		const call = await run(withQuotaServices(start()));
		await run(call.record(step(10)));
		await run(call.record(step(20)));

		await run(call.settle(outcome));

		expect(quota.calls.settle).toHaveLength(1);
		expect(quota.calls.settle[0]?.steps).toEqual([
			step(10),
			step(20),
		]);
	});

	test.each([
		[
			"failed",
			"provider_failure",
		],
		[
			"cancelled",
			"cancelled",
		],
		[
			"unused",
			"app_failure",
		],
	] as const satisfies [
		MeteredCallOutcome,
		string,
	][])(
		"a %s call without a step is released as %s",
		async (outcome, reason) => {
			const call = await run(withQuotaServices(start()));

			await run(call.settle(outcome));

			expect(quota.calls.settle[0]).toMatchObject({
				steps: [],
				reason,
			});
		},
	);

	test("settle runs once even when called twice concurrently", async () => {
		const call = await run(withQuotaServices(start()));

		await run(
			Effect.all(
				[
					call.settle("completed"),
					call.settle("failed"),
				],
				{
					concurrency: "unbounded",
				},
			),
		);
		await run(call.settle("cancelled"));

		expect(quota.calls.settle).toHaveLength(1);
		expect(quota.calls.settle[0]?.reason).toBe("app_failure");
	});

	test("a settle that fails is tried again until it succeeds", async () => {
		quota.failures.settle = 2;

		const logged = await logging(
			Effect.gen(function* () {
				const call = yield* start();
				yield* call.record(step(10));
				yield* call.settle("completed");
			}),
		);

		expect(quota.calls.settle).toHaveLength(3);
		expect(logged).toEqual([]);
	});

	test("a settle that keeps failing is logged and left to the stale job", async () => {
		quota.failures.settle = 10;

		const logged = await logging(
			Effect.gen(function* () {
				const call = yield* start();
				yield* call.record(step(10));
				yield* call.settle("completed");
			}),
		);

		expect(quota.calls.settle).toHaveLength(3);
		expect(logged).toContainEqual(
			expect.objectContaining({
				message: "quota.settle.failed",
				reservationKey: "res_request-1",
			}),
		);
	});

	test("a record that keeps failing is logged and the call goes on", async () => {
		quota.failures.record = 10;

		const logged = await logging(
			Effect.gen(function* () {
				const call = yield* start();
				yield* call.record(step(10));
				yield* call.settle("completed");
			}),
		);

		expect(logged).toContainEqual(
			expect.objectContaining({
				message: "quota.record.failed",
			}),
		);
		expect(quota.calls.settle[0]?.steps).toEqual([
			step(10),
		]);
	});

	test("settle waits for a record still being stored", async () => {
		const gate = Promise.withResolvers<void>();
		quota.recordGate = gate.promise;
		const call = await run(withQuotaServices(start()));

		const settled = await run(
			Effect.gen(function* () {
				const recording = yield* Effect.forkChild(call.record(step(10)));
				yield* Effect.yieldNow;
				const settling = yield* Effect.forkChild(call.settle("completed"));
				yield* Effect.yieldNow;
				const before = quota.calls.settle.length;
				gate.resolve();
				yield* Fiber.join(recording);
				yield* Fiber.join(settling);
				return before;
			}),
		);

		expect(settled).toBe(0);
		expect(quota.calls.settle[0]?.steps).toEqual([
			step(10),
		]);
	});

	test("a step waiting to be stored when settle starts is still charged", async () => {
		const gate = Promise.withResolvers<void>();
		quota.recordGate = gate.promise;
		const call = await run(withQuotaServices(start()));

		await run(
			Effect.gen(function* () {
				const first = yield* Effect.forkChild(call.record(step(10)));
				yield* Effect.yieldNow;
				const second = yield* Effect.forkChild(call.record(step(20)));
				yield* Effect.yieldNow;
				const settling = yield* Effect.forkChild(call.settle("completed"));
				yield* Effect.yieldNow;
				gate.resolve();
				yield* Fiber.join(first);
				yield* Fiber.join(second);
				yield* Fiber.join(settling);
			}),
		);

		expect(quota.calls.settle[0]?.steps).toEqual([
			step(10),
			step(20),
		]);
	});

	test("a step that ends after the call settled is dropped", async () => {
		const call = await run(withQuotaServices(start()));
		await run(call.settle("cancelled"));

		await run(call.record(step(10)));

		expect(quota.calls.record).toEqual([]);
		expect(quota.calls.settle[0]?.steps).toEqual([]);
	});
});
