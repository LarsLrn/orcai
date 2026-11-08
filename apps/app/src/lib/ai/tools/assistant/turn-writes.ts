import { type TurnWrite, turnWriteSchema } from "@orcai/schema";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** What an Assistant turn wrote, in the order its calls succeeded. */
export interface TurnWrites {
	/** Keeps a call that succeeded if its procedure is one the Assistant writes with. */
	record: (path: readonly string[], input: unknown, output: unknown) => void;
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

export const createTurnWrites = (): TurnWrites => {
	let writes: TurnWrite[] = [];

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
		all: () => writes,
	};
};
