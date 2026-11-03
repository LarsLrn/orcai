import type {
	BotId,
	ModelId,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import type { DB } from "@orcai/db";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";
import { METERED_CALL_TIMEOUT_MS } from "./call-timeout";
import {
	type ReleaseReason,
	recordReservationUsage,
	reserveForAppRequest,
	settleReservation,
} from "./enforcement";
import type { QuotaDeniedError, QuotaUnavailableError } from "./errors";
import type { MeteredStep } from "./usage";

/** How a quota write is tried again before it is logged and left to the stale job. */
export const QuotaRetry = Context.Reference<Schedule.Schedule<unknown>>(
	"QuotaRetry",
	{
		defaultValue: () =>
			Schedule.max([
				Schedule.exponential("100 millis"),
				Schedule.recurs(5),
			]).pipe(Schedule.jittered),
	},
);

/** How a call ended; only the release of a call without usage tells them apart. */
export type MeteredCallOutcome =
	| "completed"
	| "failed"
	| "cancelled"
	| "unused";

export interface MeteredCallInput {
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: ModelId | null;
	/** The bot whose chat the call runs in. */
	botId?: BotId | null;
	/** Provider requests the call may make at most. */
	maxRequests: number;
	/** The call's own output cap. */
	maxOutputTokens?: number;
	/** What one request sends, by `promptTokens`. */
	inputTokens: number;
}

export interface MeteredCall {
	/** Provider requests the pool granted: fewer than asked when a request quota has less left. */
	readonly maxRequests: number;
	/** Aborts once the call has run as long as its reservation may stay open. */
	readonly deadline: AbortSignal;
	/**
	 * Accounts one finished provider request and stores the call's usage so
	 * far, so the stale job can charge it if the call never settles. Never
	 * fails: a write that keeps failing is logged.
	 */
	readonly record: (step: MeteredStep) => Effect.Effect<void>;
	/** Whether the granted requests are used up. */
	readonly spent: () => boolean;
	/**
	 * Charges the recorded requests and releases the rest of the reservation,
	 * or all of it when none were recorded. Runs once, after pending records,
	 * and never fails: a write that keeps failing is logged and left to the
	 * stale job.
	 */
	readonly settle: (outcome: MeteredCallOutcome) => Effect.Effect<void>;
}

const releaseReasons = {
	completed: "app_failure",
	unused: "app_failure",
	cancelled: "cancelled",
	failed: "provider_failure",
} as const satisfies Record<MeteredCallOutcome, ReleaseReason>;

/** Reserves the call's likely use on the pool that covers the person, or fails before it runs. */
export const startMeteredCall = (
	input: MeteredCallInput,
): Effect.Effect<MeteredCall, QuotaDeniedError | QuotaUnavailableError, DB> =>
	Effect.gen(function* () {
		const reservation = yield* reserveForAppRequest(input);
		const retry = yield* QuotaRetry;
		const services = yield* Effect.context<DB>();
		const writes = yield* Semaphore.make(1);
		const settled = yield* Deferred.make<void>();
		const deadline = AbortSignal.timeout(METERED_CALL_TIMEOUT_MS);
		const maxRequests =
			reservation.meteringMode === "requests"
				? reservation.reservedAmount
				: input.maxRequests;
		const steps: MeteredStep[] = [];
		let settling = false;

		const logFailure = (message: string) => (error: unknown) =>
			Effect.logError({
				appRequestId: reservation.appRequestId,
				error: error instanceof Error ? error.message : String(error),
				message,
				reservationKey: reservation.reservationKey,
			});
		const run = <A>(effect: Effect.Effect<A, never, DB>) =>
			effect.pipe(Effect.provideContext(services));

		return {
			maxRequests,
			deadline,
			spent: () => steps.length >= maxRequests,
			record: (step) =>
				run(
					Effect.suspend(() => {
						if (settling) {
							return logFailure("quota.record.after_settle")(
								"The call already settled.",
							);
						}
						steps.push(step);
						const recorded = [
							...steps,
						];
						// A settle that started meanwhile charges the step itself.
						return writes.withPermit(
							Effect.suspend(() =>
								settling
									? Effect.void
									: recordReservationUsage({
											reservation,
											steps: recorded,
										}).pipe(
											Effect.retry(retry),
											Effect.catch(logFailure("quota.record.failed")),
										),
							),
						);
					}),
				),
			settle: (outcome) =>
				run(
					Effect.suspend(() => {
						if (settling) {
							return Deferred.await(settled);
						}
						settling = true;
						return writes
							.withPermit(
								Effect.suspend(() =>
									settleReservation({
										reservation,
										steps,
										reason: releaseReasons[outcome],
									}),
								).pipe(
									Effect.retry(retry),
									Effect.catch(logFailure("quota.settle.failed")),
								),
							)
							.pipe(
								Effect.ensuring(Deferred.succeed(settled, undefined)),
								Effect.uninterruptible,
							);
					}),
				),
		} satisfies MeteredCall;
	});

const exitOutcome = (exit: Exit.Exit<unknown, unknown>): MeteredCallOutcome =>
	Exit.isSuccess(exit)
		? "completed"
		: Exit.hasInterrupts(exit)
			? "cancelled"
			: "failed";

/** Runs `use` as one metered call, settled once whichever way it ends. */
export const meteredCall = <A, E, R>(
	input: MeteredCallInput,
	use: (call: MeteredCall) => Effect.Effect<A, E, R>,
	outcome: (exit: Exit.Exit<A, E>) => MeteredCallOutcome = exitOutcome,
) =>
	Effect.acquireUseRelease(startMeteredCall(input), use, (call, exit) =>
		call.settle(outcome(exit)),
	);
