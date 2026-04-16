import { unique } from "@/lib/utils/array-utils";

export interface RelationDelta {
	addedIds: string[];
	removedIds: string[];
}

/**
 * Computes the diff between two sets of related IDs, returning which IDs
 * were added and which were removed.
 *
 * Used to derive the minimal set of SpiceDB mutations needed after a
 * full-replace DB write (delete-all + re-insert), where the relation name
 * stays constant but the set of subjects changes.
 *
 * Duplicates in either input are removed before comparison.
 *
 * @param currentIds - IDs representing the current (before) state.
 * @param nextIds    - IDs representing the desired (after) state.
 */
export const calculateRelationDelta = <TId extends string>(
	currentIds: readonly TId[],
	nextIds: readonly TId[],
): {
	addedIds: TId[];
	removedIds: TId[];
} => {
	const currentUnique = unique(currentIds);
	const nextUnique = unique(nextIds);

	const currentSet = new Set(currentUnique);
	const nextSet = new Set(nextUnique);

	return {
		addedIds: nextUnique.filter((id) => !currentSet.has(id)),
		removedIds: currentUnique.filter((id) => !nextSet.has(id)),
	};
};
