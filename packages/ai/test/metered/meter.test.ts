import { beforeEach, describe, expect, test } from "bun:test";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import { quota, withQuotaServices } from "@orcai/quota/testing";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import { type MeterStep, startMeteredCall } from "../../src/metered/meter";

const usage = (
	inputTokens: number | undefined,
	outputTokens: number | undefined,
): MeterStep => ({
	usage: {
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
	},
	toolCalls: [],
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
		expect(quota.calls.finalize[0]?.steps).toMatchObject([
			{
				inputTokens: 100,
				outputTokens: 20,
			},
			{
				inputTokens: 150,
				outputTokens: 30,
			},
		]);
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
			_tag: "QuotaDeniedError",
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

	test("a completed call is charged each step's token classes", async () => {
		const meter = await start();

		meter.step(usage(100, 20));
		meter.step(usage(undefined, 5));
		await Effect.runPromise(meter.settle("completed"));

		expect(quota.calls.finalize[0]?.steps).toEqual([
			{
				inputTokens: 100,
				noCacheInputTokens: 100,
				cacheReadTokens: undefined,
				cacheWriteTokens: undefined,
				outputTokens: 20,
				reasoningTokens: undefined,
				totalTokens: 120,
				webSearches: 0,
			},
			{
				inputTokens: undefined,
				noCacheInputTokens: undefined,
				cacheReadTokens: undefined,
				cacheWriteTokens: undefined,
				outputTokens: 5,
				reasoningTokens: undefined,
				totalTokens: undefined,
				webSearches: 0,
			},
		]);
	});

	test("an Anthropic step keeps its cache classes and counted searches", async () => {
		const meter = await start();

		meter.step({
			usage: {
				inputTokens: 1_350,
				inputTokenDetails: {
					noCacheTokens: 50,
					cacheReadTokens: 1_000,
					cacheWriteTokens: 300,
				},
				outputTokens: 400,
				outputTokenDetails: {
					textTokens: 100,
					reasoningTokens: 300,
				},
				totalTokens: 1_750,
				raw: {
					input_tokens: 50,
					cache_read_input_tokens: 1_000,
					cache_creation_input_tokens: 300,
					output_tokens: 400,
					server_tool_use: {
						web_search_requests: 2,
					},
				},
			},
			toolCalls: [],
		});
		await Effect.runPromise(meter.settle("completed"));

		expect(quota.calls.finalize[0]?.steps).toEqual([
			{
				inputTokens: 1_350,
				noCacheInputTokens: 50,
				cacheReadTokens: 1_000,
				cacheWriteTokens: 300,
				outputTokens: 400,
				reasoningTokens: 300,
				totalTokens: 1_750,
				webSearches: 2,
			},
		]);
	});

	test("an OpenAI step counts its provider-executed web searches", async () => {
		const meter = await start();
		const call = (toolName: string, providerExecuted: boolean) => ({
			type: "tool-call" as const,
			toolCallId: crypto.randomUUID(),
			toolName,
			input: {},
			providerExecuted,
			dynamic: true as const,
		});

		meter.step({
			...usage(10, 10),
			toolCalls: [
				call("web_search", true),
				call("web_search", true),
				call("web_search", false),
				call("code_execution", true),
			],
		});
		await Effect.runPromise(meter.settle("completed"));

		expect(quota.calls.finalize[0]?.steps).toMatchObject([
			{
				webSearches: 2,
			},
		]);
	});

	test("each step keeps the cost its provider reported", async () => {
		const meter = await start();
		const reporting = (cost: number | string): MeterStep => {
			const step = usage(10, 10);
			return {
				...step,
				usage: {
					...step.usage,
					raw: {
						prompt_tokens: 10,
						completion_tokens: 10,
						cost,
					},
				},
			};
		};

		meter.step(reporting(0.0012));
		meter.step(usage(10, 10));
		meter.step(reporting("0.5"));
		meter.step(reporting(0.0005));
		await Effect.runPromise(meter.settle("completed"));

		expect(
			quota.calls.finalize[0]?.steps.map(({ reportedCost }) => reportedCost),
		).toEqual([
			0.0012,
			undefined,
			undefined,
			0.0005,
		]);
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
