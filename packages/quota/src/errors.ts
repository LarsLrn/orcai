import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

/** The quota refused a metered call before it started. */
export class QuotaDeniedError extends Data.TaggedError("QuotaDeniedError")<{
	readonly reason: "QUOTA_POOL_UNAVAILABLE" | "QUOTA_EXHAUSTED";
	readonly message: string;
	readonly cause?: unknown;
}> {}

/** The quota could not be read, so a call cannot start. Worth retrying. */
export class QuotaUnavailableError extends Data.TaggedError(
	"QuotaUnavailableError",
)<{
	readonly message: string;
	readonly cause: unknown;
}> {}

/** A change to a quota pool or its periods could not be written. */
export class QuotaWriteFailedError extends Data.TaggedError(
	"QuotaWriteFailedError",
)<{
	readonly message: string;
	readonly cause: unknown;
}> {}

export const unavailable = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(
		Effect.mapError(
			(cause) =>
				new QuotaUnavailableError({
					message: "The quota could not be read.",
					cause,
				}),
		),
	);

export const writeFailed =
	(message: string) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.mapError(
				(cause) =>
					new QuotaWriteFailedError({
						message,
						cause,
					}),
			),
		);
