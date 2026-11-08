import { mock } from "bun:test";
import { DB } from "@orcai/db";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as realEnforcement from "../src/enforcement";
import {
	QuotaDeniedError,
	QuotaUnavailableError,
	QuotaWriteFailedError,
} from "../src/errors";
import { MeteredCallDeadline, QuotaRetry } from "../src/metered-call";

/**
 * Fakes the reservations of this package for a test file, under the real
 * metered call: set `pool` per test and read what was reserved, recorded and
 * settled from `calls`.
 */

type Reserve = typeof realEnforcement.reserveForAppRequest;
type Record = typeof realEnforcement.recordReservationUsage;
type Settle = typeof realEnforcement.settleReservation;

type Pool =
	| {
			meteringMode: "requests" | "tokens";
			/** Requests or tokens left; a requests pool grants fewer requests when fewer remain. */
			remaining: number;
	  }
	| {
			denial: QuotaDeniedError["reason"];
	  }
	| {
			unavailable: true;
	  };

const defaultPool = (): Pool => ({
	meteringMode: "requests",
	remaining: 100,
});

/** The retries a test runs with: twice, without waiting. */
const TEST_RETRY = Schedule.recurs(2);

export const quota = {
	pool: defaultPool(),
	/** How many of the next calls of an operation fail. */
	failures: {} as Partial<globalThis.Record<"record" | "settle", number>>,
	/** Holds each record until it resolves. */
	recordGate: undefined as Promise<void> | undefined,
	/** Aborting it runs every metered call out of time. */
	timeLimit: new AbortController(),
	calls: {
		reserve: [] as Parameters<Reserve>[0][],
		record: [] as Parameters<Record>[0][],
		settle: [] as Parameters<Settle>[0][],
	},
	reset: () => {
		quota.pool = defaultPool();
		quota.failures = {};
		quota.recordGate = undefined;
		quota.timeLimit = new AbortController();
		quota.calls.reserve.length = 0;
		quota.calls.record.length = 0;
		quota.calls.settle.length = 0;
	},
};

const failureOf = (operation: keyof typeof quota.failures) => {
	const remaining = quota.failures[operation] ?? 0;
	if (remaining === 0) {
		return Effect.void;
	}
	quota.failures[operation] = remaining - 1;
	return Effect.fail(
		new QuotaWriteFailedError({
			message: `${operation} failed`,
			cause: new Error(`${operation} failed`),
		}),
	);
};

const reserveForAppRequest: Reserve = (input) =>
	Effect.suspend((): ReturnType<Reserve> => {
		quota.calls.reserve.push(input);
		const pool = quota.pool;
		if ("unavailable" in pool) {
			return Effect.fail(
				new QuotaUnavailableError({
					message: "The quota could not be read.",
					cause: new Error("connection refused"),
				}),
			);
		}
		if ("denial" in pool || pool.remaining < 1) {
			return Effect.fail(
				new QuotaDeniedError({
					reason: "denial" in pool ? pool.denial : "QUOTA_EXHAUSTED",
					message: "Denied by the fake quota.",
				}),
			);
		}
		return Effect.succeed({
			reservationKey: `res_${input.appRequestId}`,
			appRequestId: input.appRequestId,
			providerId: input.providerId,
			modelId: input.modelId,
			meteringMode: pool.meteringMode,
			reservedAmount:
				pool.meteringMode === "requests"
					? Math.min(pool.remaining, input.maxRequests)
					: pool.remaining,
		});
	});

const recordReservationUsage: Record = (input) =>
	Effect.suspend(() => {
		const gate = quota.recordGate;
		return (gate ? Effect.promise(() => gate) : Effect.void).pipe(
			Effect.andThen(() => {
				quota.calls.record.push(input);
				return failureOf("record");
			}),
		);
	});

const settleReservation: Settle = (input) =>
	Effect.suspend(() => {
		quota.calls.settle.push(input);
		return failureOf("settle");
	});

mock.module("../src/enforcement.ts", () => ({
	...realEnforcement,
	reserveForAppRequest,
	recordReservationUsage,
	settleReservation,
}));

/** Provides what the quota calls require; the fakes use no database, retries do not wait, and calls run out of time with `timeLimit`. */
export const withQuotaServices = <A, E>(effect: Effect.Effect<A, E, DB>) =>
	effect.pipe(
		Effect.provideService(DB, {} as never),
		Effect.provideService(QuotaRetry, TEST_RETRY),
		Effect.provideService(MeteredCallDeadline, () => quota.timeLimit.signal),
	);
