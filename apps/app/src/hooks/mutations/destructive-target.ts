export type DestructiveTarget = {
	names?: readonly (string | null | undefined)[];
};

export const singleTargetName = (count: number, target?: DestructiveTarget) => {
	if (count !== 1) return undefined;

	return target?.names?.[0]?.trim() || undefined;
};
