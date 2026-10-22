import { beforeEach, describe, expect, test } from "bun:test";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import type { LanguageModelUsage } from "ai";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import { startMeteredCall } from "./metered-call";
import { quota, withQuotaServices } from "./test-quota";

const usage = (
	inputTokens: number | undefined,
	outputTokens: number | undefined,
): LanguageModelUsage => ({
	inputTokens,
	inputTokenDetails: {
		noCacheTokens: inputTokens,
		cacheReadTokens: undefined,
		cacheWriteTokens: undefined,
	},
	outputTokens,
	outputTokenDetails: {
		textTokens: outputTokens,
		reasoningTokens: undefined,
	},
	totalTokens:
		inputTokens === undefined || outputTokens === undefined
			? undefined
			: inputTokens + outputTokens,
});

const startEffect = (maxSteps = 5) =>
	withQuotaServices(
		startMeteredCall({
			appRequestId: "request-1",
			organizationId: "org-1" as OrganizationId,
			userId: "user-1" as UserId,
			providerId: "provider-1" as ProviderId,
			modelId: "model-1",
			maxSteps,
			maxOutputTokens: 512,
			messages: [],
		}),
	);

const start = (maxSteps = 5) => Effect.runPromise(startEffect(maxSteps));

beforeEach(() => {
	quota.reset();
});

describe("startMeteredCall", () => {
	test("an aborted call is charged its finished steps, not the in-flight one", async () => {
		quota.pool = {
			meteringMode: "tokens",
			remaining: 10_000,
		};
		const meter = await start();

		meter.step(usage(100, 20));
		meter.step(usage(150, 30));
		await Effect.runPromise(meter.settle("aborted"));

		expect(quota.calls.release).toEqual([]);
		expect(quota.calls.finalize).toHaveLength(1);
		expect(quota.calls.finalize[0]).toMatchObject({
			actualRequestCount: 2,
			inputTokens: 250,
			outputTokens: 50,
			totalTokens: 300,
		});
	});

	test.each([
		[
			"no_pool",
			"QUOTA_POOL_UNAVAILABLE",
		],
		[
			"exhausted",
			"QUOTA_EXHAUSTED",
		],
		[
			"error",
			"QUOTA_CHECK_FAILED",
		],
	] as const)("a %s denial fails with %s", async (denial, reason) => {
		quota.pool = {
			denial,
		};

		const error = await Effect.runPromise(Effect.flip(startEffect()));

		expect(error).toMatchObject({
			_tag: "BadRequestError",
			reason,
		});
	});

	test("a small request quota grants fewer steps", async () => {
		quota.pool = {
			meteringMode: "requests",
			remaining: 2,
		};
		const meter = await start(5);

		expect(meter.maxSteps).toBe(2);
		meter.step(usage(1, 1));
		expect(meter.spent()).toBe(false);
		meter.step(usage(1, 1));
		expect(meter.spent()).toBe(true);
	});

	test("a token quota grants the steps asked for", async () => {
		quota.pool = {
			meteringMode: "tokens",
			remaining: 10,
		};

		expect((await start(5)).maxSteps).toBe(5);
	});

	test("the reservation knows the call's output cap", async () => {
		await start(5);

		expect(quota.calls.reserve[0]).toMatchObject({
			maxExpectedOutputTokens: 512,
		});
	});

	test("a completed call is charged its summed usage and step count", async () => {
		const meter = await start();

		meter.step(usage(100, 20));
		meter.step(usage(undefined, 5));
		await Effect.runPromise(meter.settle("completed"));

		expect(quota.calls.finalize[0]).toMatchObject({
			actualRequestCount: 2,
			inputTokens: 100,
			outputTokens: 25,
			totalTokens: 120,
		});
	});

	test("a call whose steps report no usage is charged undefined tokens", async () => {
		const meter = await start();

		meter.step(usage(undefined, undefined));
		await Effect.runPromise(meter.settle("completed"));

		expect(quota.calls.finalize[0]).toMatchObject({
			actualRequestCount: 1,
			inputTokens: undefined,
			outputTokens: undefined,
			totalTokens: undefined,
		});
	});

	test.each([
		[
			"failed",
			"provider_failure",
		],
		[
			"unused",
			"app_failure",
		],
	] as const)(
		"a %s call releases its reservation as %s",
		async (outcome, reason) => {
			const meter = await start();

			meter.step(usage(10, 10));
			await Effect.runPromise(meter.settle(outcome));

			expect(quota.calls.finalize).toEqual([]);
			expect(quota.calls.release).toHaveLength(1);
			expect(quota.calls.release[0]?.reason).toBe(reason);
		},
	);

	test("settle runs once even when called twice concurrently", async () => {
		const meter = await start();

		await Effect.runPromise(
			Effect.all(
				[
					meter.settle("completed"),
					meter.settle("failed"),
				],
				{
					concurrency: "unbounded",
				},
			),
		);
		await Effect.runPromise(meter.settle("aborted"));

		expect(quota.calls.finalize).toHaveLength(1);
		expect(quota.calls.release).toEqual([]);
	});

	test("a failing finalize is logged and settle still succeeds", async () => {
		quota.failures.finalize = new Error("ledger down");
		const meter = await start();
		const logged: unknown[] = [];
		const logger = Logger.make(({ message }) => {
			logged.push(message);
		});

		await Effect.runPromise(
			meter.settle("completed").pipe(
				Effect.provide(
					Logger.layer([
						logger,
					]),
				),
			),
		);

		expect(logged).toContainEqual([
			{
				appRequestId: "request-1",
				error: "ledger down",
				message: "quota.finalize.failed",
				reservationKey: "res_request-1",
			},
		]);
	});
});
