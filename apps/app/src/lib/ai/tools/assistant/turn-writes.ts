import { type TurnWrite, turnWriteSchema } from "@orcai/schema";
import * as Context from "effect/Context";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** How long a stopped turn waits for its running calls, so the reply stores what they wrote. */
const RUNNING_CALLS_WAIT_MS = 5_000;

const runningCallsTimeout = () => AbortSignal.timeout(RUNNING_CALLS_WAIT_MS);

/** Aborts when a stopped turn waited long enough for its running calls. */
export const RunningCallsWait = Context.Reference<() => AbortSignal>(
	"RunningCallsWait",
	{
		defaultValue: () => runningCallsTimeout,
	},
);

/** What an Assistant turn wrote, in the order its calls succeeded. */
export interface TurnWrites {
	/** Keeps a call that succeeded if its procedure is one the Assistant writes with. */
	record: (path: readonly string[], input: unknown, output: unknown) => void;
	/** Counts a call as running until `done` settles. */
	track: (done: Promise<unknown>) => void;
	/** Waits until `waitBound` aborts at most for the calls still running, which a stopped turn leaves behind. */
	settled: () => Promise<void>;
	all: () => readonly TurnWrite[];
}

/** Keeps the first of equal writes, which make the same queries stale. */
export const mergeTurnWrites = (
	...lists: (readonly TurnWrite[])[]
): TurnWrite[] => [
	...new Map(
		lists.flat().map((write) => [
			JSON.stringify(write),
			write,
		]),
	).values(),
];

export const createTurnWrites = (
	waitBound = runningCallsTimeout,
): TurnWrites => {
	let writes: TurnWrite[] = [];
	const running = new Set<Promise<unknown>>();

	return {
		record: (path, input, output) => {
			// The schema keeps only the fields the write's stale queries read.
			const parsed = turnWriteSchema.safeParse({
				...(isRecord(input) ? input : {}),
				...(isRecord(output) &&
					"handedOver" in output && {
						handedOver: output.handedOver !== null,
					}),
				path: path.join("."),
			});
			if (parsed.success) {
				writes = mergeTurnWrites(writes, [
					parsed.data,
				]);
			}
		},
		track: (done) => {
			const call = done.then(
				() => undefined,
				() => undefined,
			);
			running.add(call);
			void call.then(() => running.delete(call));
		},
		settled: async () => {
			const bound = waitBound();
			if (bound.aborted) return;
			await Promise.race([
				Promise.all(running),
				new Promise((resolve) =>
					bound.addEventListener("abort", resolve, {
						once: true,
					}),
				),
			]);
		},
		all: () => writes,
	};
};
