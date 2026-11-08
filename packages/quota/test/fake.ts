import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { QuotaReservations } from "../src/enforcement";
import {
	QuotaDeniedError,
	QuotaUnavailableError,
	QuotaWriteFailedError,
} from "../src/errors";
import { MeteredCallDeadline, QuotaRetry } from "../src/metered-call";

/**
 * Stands in for the pool writes behind the real metered call: set the
 * `reservation` the pool answers per test and read what was reserved,
 * recorded and settled from `calls`.
 */

type Reservations = QuotaReservations["Service"];

type Reservation =
	| {
			meteringMode: "requests" | "tokens";
			/** Requests or tokens the pool reserves. */
			reservedAmount: number;
	  }
	| {
			denial: QuotaDeniedError["reason"];
	  }
	| {
			unavailable: true;
	  };

const defaultReservation = (): Reservation => ({
	meteringMode: "tokens",
	reservedAmount: 100_000,
});

/** The retries a test runs with: twice, without waiting. */
const TEST_RETRY = Schedule.recurs(2);

export const quota = {
	reservation: defaultReservation(),
	/** How many of the next calls of an operation fail. */
	failures: {} as Partial<Record<"record" | "settle", number>>,
	/** Holds each record until it resolves. */
	recordGate: undefined as Promise<void> | undefined,
	/** Aborting it runs every metered call out of time. */
	timeLimit: new AbortController(),
	calls: {
		reserve: [] as Parameters<Reservations["reserve"]>[0][],
		record: [] as Parameters<Reservations["record"]>[0][],
		settle: [] as Parameters<Reservations["settle"]>[0][],
	},
	reset: () => {
		quota.reservation = defaultReservation();
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

const reservations: Reservations = {
	reserve: (input) =>
		Effect.suspend((): ReturnType<Reservations["reserve"]> => {
			quota.calls.reserve.push(input);
			const reservation = quota.reservation;
			if ("unavailable" in reservation) {
				return Effect.fail(
					new QuotaUnavailableError({
						message: "The quota could not be read.",
						cause: new Error("connection refused"),
					}),
				);
			}
			if ("denial" in reservation) {
				return Effect.fail(
					new QuotaDeniedError({
						reason: reservation.denial,
						message: "Denied by the fake quota.",
					}),
				);
			}
			return Effect.succeed({
				reservationKey: `res_${input.appRequestId}`,
				appRequestId: input.appRequestId,
				providerId: input.providerId,
				modelId: input.modelId,
				...reservation,
			});
		}),
	record: (input) =>
		Effect.suspend(() => {
			const gate = quota.recordGate;
			return (gate ? Effect.promise(() => gate) : Effect.void).pipe(
				Effect.andThen(() => {
					quota.calls.record.push(input);
					return failureOf("record");
				}),
			);
		}),
	settle: (input) =>
		Effect.suspend(() => {
			quota.calls.settle.push(input);
			return failureOf("settle");
		}),
};

/** Provides the fake pool writes; retries do not wait, and calls run out of time with `timeLimit`. */
export const withQuotaServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		Effect.provideService(QuotaReservations, reservations),
		Effect.provideService(QuotaRetry, TEST_RETRY),
		Effect.provideService(MeteredCallDeadline, () => quota.timeLimit.signal),
	);
