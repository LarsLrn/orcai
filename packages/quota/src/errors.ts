import * as Data from "effect/Data";

export class QuotaCounterStoreError extends Data.TaggedError(
	"QuotaCounterStoreError",
)<{
	readonly operation:
		| "quotaCounterStore.reserve"
		| "quotaCounterStore.finalize"
		| "quotaCounterStore.release"
		| "quotaCounterStore.getState"
		| "quotaCounterStore.overwriteState";
	readonly cause: unknown;
}> {}
