/** Returns a new array with duplicate values removed, preserving insertion order. */
export const unique = <T>(items: readonly T[]): T[] =>
	Array.from(new Set(items));

/** Adds the item to the selection, or removes it when an item with the same key is already selected. */
export const toggleSelection = <T>(
	current: T[],
	item: T,
	getKey: (item: T) => string,
): T[] => {
	const key = getKey(item);

	return current.some((selected) => getKey(selected) === key)
		? current.filter((selected) => getKey(selected) !== key)
		: [
				...current,
				item,
			];
};
