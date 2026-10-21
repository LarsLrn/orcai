import { mock } from "bun:test";
import type { QuotaPeriodId, QuotaPoolId } from "@orcai/core";
import { DB } from "@orcai/db";
import * as realQuota from "@orcai/quota";
import * as Effect from "effect/Effect";

/**
 * Fakes the quota enforcement of `@orcai/quota` for a test file: set `pool`
 * per test and read what was reserved, finalized and released from `calls`.
 */

type Reserve = typeof realQuota.reserveForAppRequest;
type Finalize = typeof realQuota.finalizeAppRequestQuota;
type Release = typeof realQuota.releaseAppRequestQuota;

type Pool =
	| {
			meteringMode: "requests" | "tokens";
			/** Requests or tokens left; a requests pool grants fewer requests when fewer remain. */
			remaining: number;
	  }
	| {
			denial: "no_pool" | "exhausted" | "error";
	  };

const defaultPool = (): Pool => ({
	meteringMode: "requests",
	remaining: 100,
});

export const quota = {
	pool: defaultPool(),
	/** Makes the next calls of an operation fail with this error. */
	failures: {} as Partial<Record<"reserve" | "finalize" | "release", Error>>,
	calls: {
		reserve: [] as Parameters<Reserve>[0][],
		finalize: [] as Parameters<Finalize>[0][],
		release: [] as Parameters<Release>[0][],
	},
	reset: () => {
		quota.pool = defaultPool();
		quota.failures = {};
		quota.calls.reserve.length = 0;
		quota.calls.finalize.length = 0;
		quota.calls.release.length = 0;
	},
};

const failureOf = (operation: keyof typeof quota.failures) =>
	quota.failures[operation] === undefined
		? Effect.void
		: Effect.fail(quota.failures[operation]);

const reserveForAppRequest: Reserve = (input) =>
	Effect.suspend(() => {
		quota.calls.reserve.push(input);
		const pool = quota.pool;

		return failureOf("reserve").pipe(
			Effect.as(
				"denial" in pool
					? {
							allowed: false,
							denialReason: pool.denial,
						}
					: pool.remaining < 1
						? {
								allowed: false,
								denialReason: "exhausted" as const,
							}
						: {
								allowed: true,
								reservation: {
									reservationKey: `res_${input.appRequestId}`,
									appRequestId: input.appRequestId,
									poolId: "pool" as QuotaPoolId,
									periodId: "period" as QuotaPeriodId,
									providerId: input.providerId,
									providerModelId: input.providerModelId ?? null,
									meteringMode: pool.meteringMode,
									reservedAmount:
										pool.meteringMode === "requests"
											? Math.min(
													pool.remaining,
													input.maxExpectedProviderRequests,
												)
											: pool.remaining,
									budgetAmount: pool.remaining,
									periodEndsAt: new Date(0),
								},
							},
			),
		);
	});

const finalizeAppRequestQuota: Finalize = (input) =>
	Effect.suspend(() => {
		quota.calls.finalize.push(input);
		return failureOf("finalize");
	});

const releaseAppRequestQuota: Release = (input) =>
	Effect.suspend(() => {
		quota.calls.release.push(input);
		return failureOf("release");
	});

mock.module("@orcai/quota", () => ({
	...realQuota,
	reserveForAppRequest,
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
}));

/** Provides the services the quota calls require; the fakes use none of them. */
export const withQuotaServices = <A, E>(
	effect: Effect.Effect<A, E, realQuota.QuotaCounterStore | DB>,
) =>
	effect.pipe(
		Effect.provideService(realQuota.QuotaCounterStore, {} as never),
		Effect.provideService(DB, {} as never),
	);
