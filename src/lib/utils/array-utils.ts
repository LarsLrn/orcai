/** Returns a new array with duplicate values removed, preserving insertion order. */
export const unique = <T>(items: readonly T[]): T[] =>
	Array.from(new Set(items));
